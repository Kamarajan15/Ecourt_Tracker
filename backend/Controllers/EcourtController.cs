using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ECourtScraperApi.Services;
using ECourtScraperApi.Models;
using ECourtScraperApi.Data;

namespace ECourtScraperApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ECourtController : ControllerBase
{
    private readonly PlaywrightSessionManager _sessionManager;
    private readonly CaseScraper _scraper;
    private readonly CaseDbContext _dbContext;
    private readonly ILogger<ECourtController> _logger;

    public ECourtController(
        PlaywrightSessionManager sessionManager,
        CaseScraper scraper,
        CaseDbContext dbContext,
        ILogger<ECourtController> logger)
    {
        _sessionManager = sessionManager;
        _scraper = scraper;
        _dbContext = dbContext;
        _logger = logger;
    }

    [HttpGet("captcha")]
    public async Task<IActionResult> GetCaptcha()
    {
        try
        {
            var result = await _sessionManager.GetCaptchaAsync();
            return Ok(new { sessionId = result.SessionId, captchaBase64 = result.CaptchaBase64 });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting captcha");
            return StatusCode(500, new { error = "Failed to load captcha. Please try again." });
        }
    }

    [HttpPost("search")]
    public async Task<IActionResult> Search([FromBody] SearchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CnrNumber))
        {
            return BadRequest(new CaseDetailsResponse { Success = false, Message = "CNR number is required." });
        }

        var cnr = request.CnrNumber.Trim();

        // 1. Check local cache if force refresh is false
        if (!request.ForceRefresh)
        {
            try
            {
                var cachedCase = await _dbContext.Cases.FindAsync(cnr);
                if (cachedCase != null)
                {
                    // Clean browser session if opened
                    if (!string.IsNullOrEmpty(request.SessionId))
                    {
                        await _sessionManager.CloseSessionAsync(request.SessionId);
                    }

                    // Save log
                    var cachedLog = new SearchLog
                    {
                        CnrNumber = cnr,
                        IsSuccess = true,
                        IsAutomated = false,
                        Message = "Instant database cache retrieval",
                        CaseTitle = cachedCase.CaseTitle,
                        CaseType = cachedCase.CaseType
                    };
                    _dbContext.SearchLogs.Add(cachedLog);
                    await _dbContext.SaveChangesAsync();

                    return Ok(new CaseDetailsResponse
                    {
                        Success = true,
                        Message = "Case loaded from database cache successfully.",
                        CaseDetails = cachedCase
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Database lookup failed, falling back to live scrape.");
            }
        }

        // 2. Perform fresh live scrape if not in cache or forced
        var page = _sessionManager.GetPage(request.SessionId);
        if (page == null)
        {
            return BadRequest(new CaseDetailsResponse { Success = false, Message = "Session expired. Please reload CAPTCHA." });
        }

        try
        {
            var response = await _scraper.ScrapeAsync(page, request);

            // Save/Update in PostgreSQL
            if (response.Success && response.CaseDetails != null)
            {
                await SaveOrUpdateCaseAsync(response.CaseDetails);
            }

            // Save search log
            var log = new SearchLog
            {
                CnrNumber = cnr,
                IsSuccess = response.Success,
                IsAutomated = false,
                Message = response.Message ?? (response.Success ? "Successfully scraped live details" : "Scraping failed"),
                CaseTitle = response.CaseDetails?.CaseTitle ?? string.Empty,
                CaseType = response.CaseDetails?.CaseType ?? string.Empty
            };
            _dbContext.SearchLogs.Add(log);
            await _dbContext.SaveChangesAsync();

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scraping failed for CNR {Cnr}", cnr);
            return StatusCode(500, new CaseDetailsResponse { Success = false, Message = "Failed to scrape data." });
        }
        finally
        {
            await _sessionManager.CloseSessionAsync(request.SessionId);
        }
    }

    [HttpPost("autosearch")]
    public async Task<IActionResult> AutoSearch([FromBody] AutoSearchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CnrNumber))
        {
            return BadRequest(new CaseDetailsResponse { Success = false, Message = "CNR number is required." });
        }

        var cnr = request.CnrNumber.Trim();

        // 1. Check local PostgreSQL database cache first
        if (!request.ForceRefresh)
        {
            try
            {
                var cachedCase = await _dbContext.Cases.FindAsync(cnr);
                if (cachedCase != null)
                {
                    var cachedLog = new SearchLog
                    {
                        CnrNumber = cnr,
                        IsSuccess = true,
                        IsAutomated = true,
                        Message = "Instant database cache retrieval",
                        CaseTitle = cachedCase.CaseTitle,
                        CaseType = cachedCase.CaseType
                    };
                    _dbContext.SearchLogs.Add(cachedLog);
                    await _dbContext.SaveChangesAsync();

                    return Ok(new CaseDetailsResponse
                    {
                        Success = true,
                        Message = "Case loaded from database cache successfully.",
                        CaseDetails = cachedCase
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Database lookup failed for CNR {Cnr}, falling back to live automated scrape.", cnr);
            }
        }

        // 2. Perform live scrape via automated Playwright + OCR solver
        var (sessionId, _) = await _sessionManager.GetCaptchaAsync();
        var page = _sessionManager.GetPage(sessionId);
        if (page == null)
        {
            return StatusCode(500, new CaseDetailsResponse { Success = false, Message = "Failed to initialize automated browser session." });
        }

        try
        {
            var response = await _scraper.AutoScrapeAsync(page, cnr);
            
            if (response.RequiresManualInput)
            {
                // Auto solver failed. Get the current captcha and return to user for manual intervention
                var captchaElement = page.Locator("#captcha_image");
                var captchaBytes = await captchaElement.ScreenshotAsync();
                response.SessionId = sessionId;
                response.CaptchaBase64 = Convert.ToBase64String(captchaBytes);
                // DO NOT close session, wait for manual input from the user
                return Ok(response);
            }

            // If successful, save to PostgreSQL cache
            if (response.Success && response.CaseDetails != null)
            {
                await SaveOrUpdateCaseAsync(response.CaseDetails);
            }

            // Save search log
            var log = new SearchLog
            {
                CnrNumber = cnr,
                IsSuccess = response.Success,
                IsAutomated = true,
                Message = response.Message ?? (response.Success ? "Successfully solved CAPTCHA and scraped live details" : "Automated scraping failed"),
                CaseTitle = response.CaseDetails?.CaseTitle ?? string.Empty,
                CaseType = response.CaseDetails?.CaseType ?? string.Empty
            };
            _dbContext.SearchLogs.Add(log);
            await _dbContext.SaveChangesAsync();

            // Close session if successful or failed for non-captcha reasons
            await _sessionManager.CloseSessionAsync(sessionId);
            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Automated OCR scraping failed for CNR {Cnr}", cnr);
            await _sessionManager.CloseSessionAsync(sessionId);
            return StatusCode(500, new CaseDetailsResponse { Success = false, Message = "Automated OCR pipeline encountered an unexpected failure." });
        }
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var totalSearches = await _dbContext.SearchLogs.CountAsync();
            var solvedCaptchas = await _dbContext.SearchLogs.CountAsync(l => l.IsAutomated && l.IsSuccess);
            var successfulSearches = await _dbContext.SearchLogs.CountAsync(l => l.IsSuccess);
            
            double successRate = totalSearches > 0 
                ? Math.Round((double)successfulSearches / totalSearches * 100, 1) 
                : 0.0;
                
            var activeSessions = _sessionManager.GetActiveSessionCount();

            return Ok(new
            {
                totalSearches,
                solvedCaptchas,
                successRate,
                activeSessions
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stats");
            return StatusCode(500, new { error = "Failed to load database stats" });
        }
    }

    [HttpGet("recent")]
    public async Task<IActionResult> GetRecentLogs()
    {
        try
        {
            var logs = await _dbContext.SearchLogs
                .OrderByDescending(l => l.SearchTime)
                .Take(10)
                .ToListAsync();

            return Ok(logs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting recent search logs");
            return StatusCode(500, new { error = "Failed to load recent logs" });
        }
    }

    [HttpGet("cases")]
    public async Task<IActionResult> GetAllCases()
    {
        try
        {
            var cases = await _dbContext.Cases
                .OrderByDescending(c => c.RegistrationDate)
                .ToListAsync();

            return Ok(cases);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all cases");
            return StatusCode(500, new { error = "Failed to load cases list" });
        }
    }

    [HttpGet("case/{cnrNumber}")]
    public async Task<IActionResult> GetCaseDetails(string cnrNumber)
    {
        try
        {
            var cnr = cnrNumber.Trim();
            var caseDetails = await _dbContext.Cases.FindAsync(cnr);
            if (caseDetails == null)
            {
                return NotFound(new { error = $"Case with CNR {cnr} not found in database." });
            }

            return Ok(new CaseDetailsResponse
            {
                Success = true,
                Message = "Loaded from local database cache successfully.",
                CaseDetails = caseDetails
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting case details for {Cnr}", cnrNumber);
            return StatusCode(500, new { error = "Failed to load case details" });
        }
    }

    [HttpDelete("case/{cnrNumber}")]
    public async Task<IActionResult> DeleteCase(string cnrNumber)
    {
        try
        {
            var cnr = cnrNumber.Trim();
            var caseDetails = await _dbContext.Cases.FindAsync(cnr);
            if (caseDetails == null)
            {
                return NotFound(new { error = "Case not found." });
            }

            _dbContext.Cases.Remove(caseDetails);
            await _dbContext.SaveChangesAsync();

            return Ok(new { message = $"Case {cnr} removed from database cache successfully." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting case {Cnr}", cnrNumber);
            return StatusCode(500, new { error = "Failed to delete case from cache" });
        }
    }

    private async Task SaveOrUpdateCaseAsync(CaseData caseData)
    {
        var existingCase = await _dbContext.Cases.FindAsync(caseData.CnrNumber);
        if (existingCase != null)
        {
            // Set all scalar values
            _dbContext.Entry(existingCase).CurrentValues.SetValues(caseData);
            
            // Re-assign lists so EF Core updates JSON columns
            existingCase.Petitioners = caseData.Petitioners;
            existingCase.Respondents = caseData.Respondents;
            existingCase.Acts = caseData.Acts;
            existingCase.Hearings = caseData.Hearings;
            existingCase.Orders = caseData.Orders;
            existingCase.Processes = caseData.Processes;
            existingCase.TransferDetails = caseData.TransferDetails;
            existingCase.IAStatuses = caseData.IAStatuses;
        }
        else
        {
            await _dbContext.Cases.AddAsync(caseData);
        }
    }
}
