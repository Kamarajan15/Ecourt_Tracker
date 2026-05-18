using Microsoft.AspNetCore.Mvc;
using ECourtScraperApi.Services;
using System.IO;

namespace ECourtScraperApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CaptchaController : ControllerBase
{
    private readonly CaptchaSolverService _solver;
    private readonly ILogger<CaptchaController> _logger;

    public CaptchaController(CaptchaSolverService solver, ILogger<CaptchaController> logger)
    {
        _solver = solver;
        _logger = logger;
    }

    [HttpPost("predict")]
    public async Task<IActionResult> Predict(IFormFile image)
    {
        if (image == null || image.Length == 0)
        {
            return BadRequest(new { error = "No image file provided." });
        }

        try
        {
            using var ms = new MemoryStream();
            await image.CopyToAsync(ms);
            var bytes = ms.ToArray();

            var prediction = await _solver.PredictAsync(bytes);

            // We consider confidence >= 80 as high confidence (80-95% goal)
            bool isHighConfidence = prediction.Confidence >= 80.0 && !string.IsNullOrEmpty(prediction.Text);

            var response = new
            {
                predictedText = prediction.Text,
                confidence = prediction.Confidence,
                usedStrategy = prediction.UsedStrategy,
                isHighConfidence = isHighConfidence,
                action = isHighConfidence ? "auto-submit" : "manual-input",
                message = isHighConfidence 
                    ? "High confidence prediction, ready for auto-submit." 
                    : "Low confidence prediction, requires manual fallback."
            };

            return Ok(response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing CAPTCHA prediction.");
            return StatusCode(500, new { error = "An internal error occurred while processing the CAPTCHA image." });
        }
    }
}
