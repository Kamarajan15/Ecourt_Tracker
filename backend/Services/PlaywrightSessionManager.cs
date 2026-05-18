using Microsoft.Playwright;
using System.Collections.Concurrent;

namespace ECourtScraperApi.Services;

public class PlaywrightSessionManager : IAsyncDisposable
{
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private readonly ConcurrentDictionary<string, IPage> _pages = new();
    private readonly ConcurrentDictionary<string, DateTime> _lastAccess = new();
    private readonly ConcurrentQueue<IPage> _preloadedPool = new();
    private readonly ILogger<PlaywrightSessionManager> _logger;
    private const int PoolSize = 3;
    private bool _isRefilling = false;

    public PlaywrightSessionManager(ILogger<PlaywrightSessionManager> logger)
    {
        _logger = logger;
    }

    public async Task InitializeAsync()
    {
        if (_playwright == null)
        {
            _logger.LogInformation("Initializing Playwright Service...");
            _playwright = await Playwright.CreateAsync();
            _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions 
            { 
                Headless = true,
                Args = new[] { "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage" }
            });

            // Start initial pool filling (commented out to support completely lazy loading on demand)
            // _ = RefillPoolAsync();
            
            // Cleanup task
            _ = CleanupTaskAsync();
        }
    }

    private async Task RefillPoolAsync()
    {
        if (_isRefilling || _browser == null) return;
        _isRefilling = true;

        try
        {
            while (_preloadedPool.Count < PoolSize)
            {
                _logger.LogInformation("Pre-loading page for pool (Current: {Count})", _preloadedPool.Count);
                var context = await _browser.NewContextAsync();
                var page = await context.NewPageAsync();
                page.SetDefaultTimeout(45000);
                
                try
                {
                    // Navigate and wait only for DOM to be ready
                    await page.GotoAsync("https://services.ecourts.gov.in/ecourtindia_v6/?p=home/index", 
                        new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded });
                    
                    // Wait for CAPTCHA element specifically
                    await page.Locator("#captcha_image").WaitForAsync();
                    
                    _preloadedPool.Enqueue(page);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Failed to pre-load page: {Msg}", ex.Message);
                    await page.Context.CloseAsync();
                }
            }
        }
        finally
        {
            _isRefilling = false;
        }
    }

    private async Task CleanupTaskAsync()
    {
        while (true)
        {
            await Task.Delay(TimeSpan.FromMinutes(1));
            var now = DateTime.UtcNow;
            
            // Cleanup used sessions
            foreach (var kvp in _lastAccess)
            {
                if (now - kvp.Value > TimeSpan.FromMinutes(5))
                {
                    await CloseSessionAsync(kvp.Key);
                }
            }

            // Also check for stale pool pages (eCourts sessions might expire)
            if (_preloadedPool.Count > 0 && now.Minute % 10 == 0)
            {
                _logger.LogInformation("Cleaning up stale pre-loaded pages from pool to prevent idle IP blocks.");
                while (_preloadedPool.TryDequeue(out var page))
                {
                    await page.Context.CloseAsync();
                }
                // DO NOT refill here. We let the pool remain empty while idle, completely eliminating continuous background traffic.
            }
        }
    }

    public async Task<(string SessionId, string CaptchaBase64)> GetCaptchaAsync()
    {
        if (_browser == null) await InitializeAsync();

        IPage? page = null;
        
        // Try to get from pool for instant response
        if (!_preloadedPool.TryDequeue(out page))
        {
            _logger.LogInformation("Pool empty, creating page on-demand (Slow path)");
            var context = await _browser!.NewContextAsync();
            page = await context.NewPageAsync();
            await page.GotoAsync("https://services.ecourts.gov.in/ecourtindia_v6/?p=home/index", 
                new PageGotoOptions { WaitUntil = WaitUntilState.DOMContentLoaded });
        }
        else
        {
            _logger.LogInformation("Captcha requested - Serving from pre-loaded pool (Instant path)");
        }

        // Trigger background refill immediately
        _ = RefillPoolAsync();

        var captchaElement = page.Locator("#captcha_image");
        await captchaElement.WaitForAsync();

        // Reduced delay - just enough for the browser to paint the fetched image
        await Task.Delay(150);
        
        var captchaBytes = await captchaElement.ScreenshotAsync(new LocatorScreenshotOptions 
        { 
            Type = ScreenshotType.Png,
            Animations = ScreenshotAnimations.Disabled
        });
        
        var base64 = Convert.ToBase64String(captchaBytes);
        var sessionId = Guid.NewGuid().ToString();
        
        _pages[sessionId] = page;
        _lastAccess[sessionId] = DateTime.UtcNow;

        return (sessionId, base64);
    }

    public IPage? GetPage(string sessionId)
    {
        if (_pages.TryGetValue(sessionId, out var page))
        {
            _lastAccess[sessionId] = DateTime.UtcNow;
            return page;
        }
        return null;
    }

    public async Task CloseSessionAsync(string sessionId)
    {
        if (_pages.TryRemove(sessionId, out var page))
        {
            _lastAccess.TryRemove(sessionId, out _);
            try
            {
                await page.Context.CloseAsync();
            }
            catch { /* Ignore */ }
        }
    }

    public int GetActiveSessionCount()
    {
        return _pages.Count;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var key in _pages.Keys) await CloseSessionAsync(key);
        while (_preloadedPool.TryDequeue(out var page)) await page.Context.CloseAsync();
        
        if (_browser != null) await _browser.CloseAsync();
        if (_playwright != null) _playwright.Dispose();
    }
}
