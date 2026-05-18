using ECourtScraperApi.Models;
using Microsoft.Playwright;
using System.Text.RegularExpressions;
using System.IO;

namespace ECourtScraperApi.Services;

public class CaseScraper
{
    private readonly ILogger<CaseScraper> _logger;
    private readonly CaptchaSolverService _captchaSolver;

    public CaseScraper(ILogger<CaseScraper> logger, CaptchaSolverService captchaSolver)
    {
        _logger = logger;
        _captchaSolver = captchaSolver;
    }

    public async Task<CaseDetailsResponse> ScrapeAsync(IPage page, SearchRequest request)
    {
        var response = new CaseDetailsResponse { Success = false };
        try
        {
            string? alertMessage = null;
            page.Dialog += (_, dialog) =>
            {
                alertMessage = dialog.Message;
                _ = dialog.AcceptAsync();
            };
            await page.Locator("#cino").FillAsync(request.CnrNumber);
            await page.Locator("#fcaptcha_code").FillAsync(request.Captcha);
            await page.Locator("#searchbtn").ClickAsync();

            // The site may show an error message in #errSpan, show an alert(),
            // or it may load a new view with .case_details_table

            var errorLocator = page.Locator("#errSpan, .alert-danger, #validateError").Filter(new() { HasTextRegex = new Regex("[a-zA-Z]") });
            var successLocator = page.Locator(".case_details_table");

            // wait for either of them using polling
            for (int i = 0; i < 30; i++) // 15 seconds
            {
                await Task.Delay(500);

                if (alertMessage != null)
                {
                    response.Message = alertMessage;
                    return response;
                }

                var errorCount = await errorLocator.CountAsync();
                if (errorCount > 0)
                {
                    var text = await errorLocator.First.InnerTextAsync();
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        response.Message = text.Trim();
                        return response; // Success = false
                    }
                }

                var successCount = await successLocator.CountAsync();
                if (successCount > 0)
                {
                    break; // Success! It loaded the details.
                }
            }

            var finalSuccessCount = await successLocator.CountAsync();
            if (finalSuccessCount == 0 && alertMessage == null)
            {
                response.Message = "Timeout waiting for results or no case found with the provided details.";
                return response;
            }

            return await ExtractCaseDetailsAsync(page, request.CnrNumber);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scraping case details.");
            response.Message = "An unexpected error occurred during scraping.";
            return response;
        }
    }

    public async Task<CaseDetailsResponse> AutoScrapeAsync(IPage page, string cnrNumber)
    {
        var response = new CaseDetailsResponse { Success = false };

        try
        {
            string? alertMessage = null;
            page.Dialog += (_, dialog) =>
            {
                alertMessage = dialog.Message;
                _ = dialog.AcceptAsync();
            };

            int maxAttempts = 10;
            for (int attempt = 1; attempt <= maxAttempts; attempt++)
            {
                _logger.LogInformation("AutoScrape attempt {Attempt} of {MaxAttempts} for CNR {Cnr}", attempt, maxAttempts, cnrNumber);
                alertMessage = null;

                if (attempt > 1)
                {
                    _logger.LogInformation("Reloading page for fresh CAPTCHA challenge...");
                    await page.ReloadAsync();
                    await Task.Delay(1000); // Give extra stabilization buffer after reload
                }

                var captchaElement = page.Locator("#captcha_image");
                await captchaElement.WaitForAsync();
                await Task.Delay(600); // Allow CAPTCHA image rendering to stabilize completely

                var captchaBytes = await captchaElement.ScreenshotAsync();

                string captchaText = string.Empty;
                try
                {
                    var prediction = await _captchaSolver.PredictAsync(captchaBytes);
                    captchaText = prediction.Text;
                    _logger.LogInformation("OCR extracted CAPTCHA: '{CaptchaText}' with confidence {Confidence} using {Strategy}", captchaText, prediction.Confidence, prediction.UsedStrategy);

                    // Write debug outputs to inspect filter outcomes
                    try
                    {
                        var debugDir = Path.Combine(Directory.GetCurrentDirectory(), "captcha_debug");
                        Directory.CreateDirectory(debugDir);
                        await File.WriteAllBytesAsync(Path.Combine(debugDir, $"attempt_{attempt}_input.png"), captchaBytes);
                        await File.WriteAllTextAsync(Path.Combine(debugDir, $"attempt_{attempt}_result.txt"), $"Extracted: {captchaText}\nConfidence: {prediction.Confidence}\nStrategy: {prediction.UsedStrategy}");
                    }
                    catch { /* ignore debug file write errors */ }
                }
                catch (Exception ocrEx)
                {
                    _logger.LogWarning(ocrEx, "OCR processing failed on attempt {Attempt}", attempt);
                }

                if (string.IsNullOrEmpty(captchaText) || captchaText.Length < 3)
                {
                    _logger.LogWarning("Extracted CAPTCHA text is too short or empty. Retrying next filter strategy...");
                    continue;
                }

                await page.Locator("#cino").FillAsync(cnrNumber);
                await page.Locator("#fcaptcha_code").FillAsync(captchaText);
                await page.Locator("#searchbtn").ClickAsync();

                var errorLocator = page.Locator("#errSpan, .alert-danger, #validateError").Filter(new() { HasTextRegex = new Regex("[a-zA-Z]") });
                var successLocator = page.Locator(".case_details_table");

                bool isCaptchaError = false;
                bool successFound = false;

                for (int i = 0; i < 20; i++) // poll up to 10 seconds
                {
                    await Task.Delay(500);

                    if (alertMessage != null)
                    {
                        if (alertMessage.Contains("captcha", StringComparison.OrdinalIgnoreCase) ||
                            alertMessage.Contains("code", StringComparison.OrdinalIgnoreCase) ||
                            alertMessage.Contains("invalid", StringComparison.OrdinalIgnoreCase))
                        {
                            isCaptchaError = true;
                            break;
                        }
                        else
                        {
                            response.Message = alertMessage;
                            return response;
                        }
                    }

                    var errorCount = await errorLocator.CountAsync();
                    if (errorCount > 0)
                    {
                        var text = await errorLocator.First.InnerTextAsync();
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            if (text.Contains("captcha", StringComparison.OrdinalIgnoreCase) ||
                                text.Contains("code", StringComparison.OrdinalIgnoreCase))
                            {
                                isCaptchaError = true;
                                break;
                            }
                            else
                            {
                                response.Message = text.Trim();
                                return response;
                            }
                        }
                    }

                    var successCount = await successLocator.CountAsync();
                    if (successCount > 0)
                    {
                        successFound = true;
                        break;
                    }
                }

                if (successFound)
                {
                    _logger.LogInformation("Successfully bypassed CAPTCHA on attempt {Attempt}", attempt);
                    return await ExtractCaseDetailsAsync(page, cnrNumber);
                }

                if (alertMessage != null && !isCaptchaError)
                {
                    response.Message = alertMessage;
                    return response;
                }

                _logger.LogWarning("CAPTCHA validation failed or timed out on attempt {Attempt}. Cycling to next filter strategy...", attempt);
            }

            response.Message = "Automated CAPTCHA solving failed after 10 filter strategy attempts. Please verify the challenge manually.";
            response.RequiresManualInput = true;
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during automated scraping.");
            response.Message = "An unexpected error occurred during automated OCR execution.";
            return response;
        }
    }

    private async Task<CaseDetailsResponse> ExtractCaseDetailsAsync(IPage page, string cnrNumber)
    {
        var response = new CaseDetailsResponse { Success = false };
        var caseData = new CaseData { CnrNumber = cnrNumber };

        try
        {
            // Extract case details from tables
            // First table usually contains Case Type, Filing Number, Filing Date, Registration Number, Registration Date
            var caseDetailsTable = page.Locator(".case_details_table").First;
            if (await caseDetailsTable.CountAsync() > 0)
            {
                var text = await caseDetailsTable.InnerTextAsync();
                caseData.CaseType = ExtractPattern(text, @"Case Type\s+(.*?)\s+(?:Filing Number|Filing Date)");
                caseData.FilingNumber = ExtractPattern(text, @"Filing Number\s+(.*?)\s+(?:Filing Date|Registration Number)");
                caseData.FilingDate = ExtractPattern(text, @"Filing Date\s+(.*?)\s+(?:Registration Number|Registration Date|$)");
                caseData.RegistrationNumber = ExtractPattern(text, @"Registration Number\s+(.*?)\s+(?:Registration Date|$)");
                caseData.RegistrationDate = ExtractPattern(text, @"Registration Date\s+(.*?)$");
            }

            // Second table: Case Status
            var statusTable = page.Locator(".case_status_table").First;
            if (await statusTable.CountAsync() > 0)
            {
                var text = await statusTable.InnerTextAsync();
                caseData.FirstHearingDate = ExtractPattern(text, @"First Hearing Date\s+(.*?)\s+(?:Next Hearing Date|Decision Date|Case Stage|Case Status|Court Number)");
                caseData.NextHearingDate = ExtractPattern(text, @"Next Hearing Date\s+(.*?)\s+(?:Case Stage|Case Status|Court Number|Nature of Disposal)");
                caseData.DecisionDate = ExtractPattern(text, @"Decision Date\s+(.*?)\s+(?:Case Stage|Case Status|Court Number|Nature of Disposal)");
                caseData.CaseStatus = ExtractPattern(text, @"(?:Case Stage|Case Status)\s+(.*?)\s+(?:Court Number|Nature of Disposal|$)");
                caseData.CourtEstablishment = ExtractPattern(text, @"Court Number and Judge\s+(.*?)$");

                // Also assign Judge field if present in CourtEstablishment
                caseData.Judge = caseData.CourtEstablishment;
            }

            // Petitioner and Advocate
            var petitionerTable = page.Locator(".Petitioner_Advocate_table").First;
            if (await petitionerTable.CountAsync() > 0)
            {
                var text = await petitionerTable.InnerTextAsync();
                ParseParties(text, caseData.Petitioners, out var adv);
                caseData.PetitionerAdvocate = adv;
            }

            // Respondent and Advocate
            var respondentTable = page.Locator(".Respondent_Advocate_table").First;
            if (await respondentTable.CountAsync() > 0)
            {
                var text = await respondentTable.InnerTextAsync();
                ParseParties(text, caseData.Respondents, out var adv);
                caseData.RespondentAdvocate = adv;
            }

            // Auto-populate Case Title if possible
            if (string.IsNullOrWhiteSpace(caseData.CaseTitle) && caseData.Petitioners.Any() && caseData.Respondents.Any())
            {
                caseData.CaseTitle = $"{caseData.Petitioners.First()} vs {caseData.Respondents.First()}";
            }

            // Acts
            var actsTable = page.Locator(".acts_table").First;
            if (await actsTable.CountAsync() > 0)
            {
                var rows = await actsTable.Locator("tr").AllAsync();
                foreach (var row in rows)
                {
                    var cells = await row.Locator("td").AllInnerTextsAsync();
                    if (cells.Count >= 2)
                    {
                        var actName = cells[0].Trim();
                        var section = cells[1].Trim();
                        if (!string.IsNullOrWhiteSpace(actName) && !actName.Equals("Under Act", StringComparison.OrdinalIgnoreCase))
                        {
                            caseData.Acts.Add($"{actName} - {section}");
                        }
                    }
                }
            }

            // Hearing History
            var historyLocator = page.Locator("#history_table").First;
            if (await historyLocator.CountAsync() > 0)
            {
                var rows = await historyLocator.Locator("tr").AllAsync();
                foreach (var row in rows)
                {
                    var cells = await row.Locator("td").AllInnerTextsAsync();
                    if (cells.Count >= 4)
                    {
                        var judge = cells[0].Trim();
                        if (!string.IsNullOrWhiteSpace(judge) && !judge.Equals("Judge", StringComparison.OrdinalIgnoreCase))
                        {
                            caseData.Hearings.Add(new HearingHistory
                            {
                                Judge = judge,
                                BusinessOnDate = cells[1].Trim(),
                                HearingDate = cells[2].Trim(),
                                Purpose = cells[3].Trim()
                            });
                        }
                    }
                }
            }

            // Order Details
            var ordersTable = page.Locator(".order_table").First;
            if (await ordersTable.CountAsync() > 0)
            {
                var rows = await ordersTable.Locator("tr").AllAsync();
                foreach (var row in rows)
                {
                    var cells = await row.Locator("td").AllInnerTextsAsync();
                    if (cells.Count >= 2)
                    {
                        var orderNum = cells[0].Trim();
                        var orderDate = cells[1].Trim();
                        if (!string.IsNullOrWhiteSpace(orderNum) && !orderNum.Equals("Order Number", StringComparison.OrdinalIgnoreCase))
                        {
                            caseData.Orders.Add(new OrderDetails
                            {
                                OrderNumber = orderNum,
                                OrderDate = orderDate
                            });
                        }
                    }
                }
            }

            // Processes
            var processesTable = page.Locator("table").Filter(new() { HasTextRegex = new Regex("Process ID|Process Title", RegexOptions.IgnoreCase) }).First;
            if (await processesTable.CountAsync() > 0)
            {
                var rows = await processesTable.Locator("tr").AllAsync();
                foreach (var row in rows)
                {
                    var cells = await row.Locator("td").AllInnerTextsAsync();
                    if (cells.Count >= 3)
                    {
                        var procId = cells[0].Trim();
                        if (!string.IsNullOrWhiteSpace(procId) && !procId.Equals("Process ID", StringComparison.OrdinalIgnoreCase))
                        {
                            caseData.Processes.Add(new ProcessDetail
                            {
                                ProcessId = procId,
                                Title = cells[1].Trim(),
                                Date = cells[2].Trim()
                            });
                        }
                    }
                }
            }

            // Case Transfer Details
            var transferTable = page.Locator("table").Filter(new() { HasTextRegex = new Regex("Case Transfer Details|Transfer Date", RegexOptions.IgnoreCase) }).First;
            if (await transferTable.CountAsync() > 0)
            {
                var rows = await transferTable.Locator("tr").AllAsync();
                foreach (var row in rows)
                {
                    var cells = await row.Locator("td").AllInnerTextsAsync();
                    if (cells.Count >= 4)
                    {
                        var regNum = cells[0].Trim();
                        if (!string.IsNullOrWhiteSpace(regNum) && !regNum.Equals("Regn. Number", StringComparison.OrdinalIgnoreCase) && !regNum.Equals("Registration Number", StringComparison.OrdinalIgnoreCase))
                        {
                            caseData.TransferDetails.Add(new TransferDetail
                            {
                                RegistrationNumber = regNum,
                                TransferDate = cells[1].Trim(),
                                FromCourt = cells[2].Trim(),
                                ToCourt = cells[3].Trim()
                            });
                        }
                    }
                }
            }

            // IA Status
            var iaTable = page.Locator("table").Filter(new() { HasTextRegex = new Regex("IA Number", RegexOptions.IgnoreCase) }).First;
            if (await iaTable.CountAsync() > 0)
            {
                var rows = await iaTable.Locator("tr").AllAsync();
                foreach (var row in rows)
                {
                    var cells = await row.Locator("td").AllInnerTextsAsync();
                    if (cells.Count >= 5)
                    {
                        var iaNum = cells[0].Trim();
                        if (!string.IsNullOrWhiteSpace(iaNum) && !iaNum.Equals("IA Number", StringComparison.OrdinalIgnoreCase))
                        {
                            caseData.IAStatuses.Add(new IAStatus
                            {
                                IANumber = iaNum,
                                PartyName = cells[1].Trim(),
                                FilingDate = cells[2].Trim(),
                                NextDate = cells[3].Trim(),
                                Status = cells[4].Trim()
                            });
                        }
                    }
                }
            }

            response.Success = true;
            response.CaseDetails = caseData;
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting case data tables.");
            response.Message = "An unexpected error occurred while parsing case detail structures.";
            return response;
        }
    }

    private string ExtractPattern(string input, string pattern)
    {
        var match = Regex.Match(input, pattern, RegexOptions.Singleline | RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value.Trim() : string.Empty;
    }

    private void ParseParties(string text, List<string> partyList, out string advocate)
    {
        advocate = string.Empty;
        var lines = text.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("Petitioner and Advocate", StringComparison.OrdinalIgnoreCase) ||
                trimmed.StartsWith("Respondent and Advocate", StringComparison.OrdinalIgnoreCase))
                continue;

            if (trimmed.Contains("Advocate", StringComparison.OrdinalIgnoreCase))
            {
                var idx = trimmed.IndexOf('-');
                if (idx < 0) idx = trimmed.IndexOf(':');
                if (idx >= 0)
                {
                    advocate = trimmed.Substring(idx + 1).Trim();
                }
                else
                {
                    advocate = Regex.Replace(trimmed, "Advocate", "", RegexOptions.IgnoreCase).Trim();
                }
                continue;
            }

            // Match "1) Name" or "1. Name"
            var match = Regex.Match(trimmed, @"^\d+[\)\.]\s*(.*)");
            if (match.Success)
            {
                partyList.Add(match.Groups[1].Value.Trim());
            }
            else if (!string.IsNullOrWhiteSpace(trimmed))
            {
                // In case it's an unnumbered party
                partyList.Add(trimmed);
            }
        }
    }
}
