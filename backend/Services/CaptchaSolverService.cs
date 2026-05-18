using Tesseract;
using System.Text.RegularExpressions;
using SkiaSharp;
using System.IO;

namespace ECourtScraperApi.Services;

public class CaptchaPrediction
{
    public string Text { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public string UsedStrategy { get; set; } = string.Empty;
}

public class CaptchaSolverService : IDisposable
{
    private readonly ILogger<CaptchaSolverService> _logger;
    private readonly TesseractEngine _ocrEngine;

    public CaptchaSolverService(ILogger<CaptchaSolverService> logger)
    {
        _logger = logger;

        string tessDataPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tessdata");
        if (!Directory.Exists(tessDataPath))
        {
            tessDataPath = "tessdata";
        }

        _ocrEngine = new TesseractEngine(tessDataPath, "eng", EngineMode.Default);
        _ocrEngine.SetVariable("tessedit_char_whitelist", "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789");
    }

    public async Task<CaptchaPrediction> PredictAsync(byte[] imageBytes)
    {
        var bestPrediction = new CaptchaPrediction { Confidence = 0 };

        for (int strategy = 1; strategy <= 5; strategy++)
        {
            try
            {
                byte[] processedBytes = ApplyStrategy(imageBytes, strategy);

                using var pix = Pix.LoadFromMemory(processedBytes);
                using var page = _ocrEngine.Process(pix, PageSegMode.SingleLine);

                var text = page.GetText();
                if (text != null)
                {
                    text = Regex.Replace(text, "[^a-zA-Z0-9]", "").Trim();
                }
                else
                {
                    text = string.Empty;
                }

                float confidence = page.GetMeanConfidence() * 100f;

                _logger.LogInformation("OCR Strategy {Strategy} extracted '{Text}' with confidence {Confidence}", strategy, text, confidence);

                bool isValidLength = text.Length >= 5 && text.Length <= 7;

                if (isValidLength && confidence > bestPrediction.Confidence)
                {
                    bestPrediction.Text = text;
                    bestPrediction.Confidence = confidence;
                    bestPrediction.UsedStrategy = $"Strategy_{strategy}";
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error processing image with OCR Strategy {Strategy}", strategy);
            }
        }

        return await Task.FromResult(bestPrediction);
    }

    private byte[] ApplyStrategy(byte[] imageBytes, int strategy)
    {
        using var original = SKBitmap.Decode(imageBytes);

        // Scale up by 2x for better OCR
        int newWidth = original.Width * 2;
        int newHeight = original.Height * 2;
        using var scaled = new SKBitmap(newWidth, newHeight);
        original.ScalePixels(scaled, SKFilterQuality.High);

        using var processed = new SKBitmap(newWidth, newHeight);

        // Process pixels based on strategy
        float threshold = 0.5f;
        bool invert = false;

        switch (strategy)
        {
            case 1: threshold = 0.5f; break;
            case 2: threshold = 0.4f; break;
            case 3: threshold = 0.6f; break;
            case 4: threshold = 0.5f; invert = true; break;
            case 5: threshold = 0.45f; break;
        }

        for (int y = 0; y < newHeight; y++)
        {
            for (int x = 0; x < newWidth; x++)
            {
                var color = scaled.GetPixel(x, y);
                // Simple Grayscale
                float gray = (color.Red * 0.299f + color.Green * 0.587f + color.Blue * 0.114f) / 255f;

                if (invert) gray = 1.0f - gray;

                // Thresholding
                if (gray < threshold)
                {
                    processed.SetPixel(x, y, SKColors.Black);
                }
                else
                {
                    processed.SetPixel(x, y, SKColors.White);
                }
            }
        }

        // Add padding
        int padding = 20;
        using var surface = SKSurface.Create(new SKImageInfo(newWidth + padding * 2, newHeight + padding * 2));
        var canvas = surface.Canvas;
        canvas.Clear(SKColors.White);
        canvas.DrawBitmap(processed, padding, padding);

        using var image = surface.Snapshot();
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }


    public void Dispose()
    {
        _ocrEngine?.Dispose();
    }
}
