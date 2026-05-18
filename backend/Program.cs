using ECourtScraperApi.Services;
using ECourtScraperApi.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register the PostgreSQL DbContext
builder.Services.AddDbContext<CaseDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        builder =>
        {
            builder.AllowAnyOrigin()
                   .AllowAnyMethod()
                   .AllowAnyHeader();
        });
});

// Register the Playwright session manager as a singleton
builder.Services.AddSingleton<PlaywrightSessionManager>();
builder.Services.AddScoped<CaseScraper>();
builder.Services.AddScoped<CaptchaSolverService>();

var app = builder.Build();

// Automatically ensure the database and tables are created
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CaseDbContext>();
    try
    {
        dbContext.Database.EnsureCreated();
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "An error occurred while creating the database. Make sure PostgreSQL is running.");
    }
}


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

// Auto-install Playwright browsers on startup
try
{
    var exitCode = Microsoft.Playwright.Program.Main(new[] { "install", "chromium" });
    if (exitCode != 0)
    {
        app.Logger.LogWarning("Playwright install exited with code {ExitCode}", exitCode);
    }
}
catch (Exception ex)
{
    app.Logger.LogError(ex, "Failed to install Playwright browser automatically.");
}

app.Run();
