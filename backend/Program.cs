using ECourtScraperApi.Services;
using ECourtScraperApi.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ECourtScraperApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure JWT Bearer Authentication
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "ecourt-tracker-super-secret-key-that-is-at-least-32-chars-long";
var key = Encoding.ASCII.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false
    };
});

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

// Automatically ensure the database and tables are created and seed the default admin
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CaseDbContext>();
    try
    {
        dbContext.Database.EnsureCreated();

        // Dynamically ensure the FollowedCases table is created in PostgreSQL
        dbContext.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""FollowedCases"" (
                ""Id"" SERIAL PRIMARY KEY,
                ""UserId"" INTEGER NOT NULL,
                ""CnrNumber"" VARCHAR(50) NOT NULL,
                ""CaseTitle"" VARCHAR(255) NOT NULL,
                ""CaseStatus"" VARCHAR(100) NOT NULL,
                ""FollowedAt"" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        ");
        
        // Seed Admin user if database is empty or no admin exists
        if (!dbContext.Users.Any(u => u.Role == "Admin"))
        {
            var adminUser = new User
            {
                Username = "admin",
                PasswordHash = PasswordHasher.HashPassword("admin123"),
                Role = "Admin",
                CreatedAt = DateTime.UtcNow
            };
            dbContext.Users.Add(adminUser);
            dbContext.SaveChanges();
            app.Logger.LogInformation("Successfully seeded default Admin user: admin / admin123");
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "An error occurred while creating/seeding the database. Make sure PostgreSQL is running.");
    }
}


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseAuthentication();
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
