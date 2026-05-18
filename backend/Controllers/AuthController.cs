using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ECourtScraperApi.Models;
using ECourtScraperApi.Data;
using ECourtScraperApi.Services;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace ECourtScraperApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly CaseDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(CaseDbContext dbContext, IConfiguration configuration, ILogger<AuthController> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new AuthResponse { Success = false, Message = "Username and password are required." });
            }

            var usernameNormalized = request.Username.Trim().ToLower();

            // Check if user already exists
            var existingUser = await _dbContext.Users.AnyAsync(u => u.Username.ToLower() == usernameNormalized);
            if (existingUser)
            {
                return BadRequest(new AuthResponse { Success = false, Message = "Username is already taken." });
            }

            var role = "User";
            if (request.Role.Equals("Admin", StringComparison.OrdinalIgnoreCase))
            {
                // Verify admin secret key
                var adminSecret = _configuration["Jwt:AdminSecretKey"] ?? "ecourt_admin_secret_2026";
                if (request.AdminSecretKey != adminSecret)
                {
                    return BadRequest(new AuthResponse { Success = false, Message = "Invalid admin secret key. Cannot register as Admin." });
                }
                role = "Admin";
            }

            var newUser = new User
            {
                Username = request.Username.Trim(),
                PasswordHash = PasswordHasher.HashPassword(request.Password),
                Role = role,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Users.Add(newUser);
            await _dbContext.SaveChangesAsync();

            return Ok(new AuthResponse
            {
                Success = true,
                Message = $"User registered successfully as {role}."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during registration");
            return StatusCode(500, new AuthResponse { Success = false, Message = "Internal server error during registration." });
        }
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new AuthResponse { Success = false, Message = "Username and password are required." });
            }

            var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.Trim().ToLower());
            if (user == null || !PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
            {
                return Unauthorized(new AuthResponse { Success = false, Message = "Invalid username or password." });
            }

            // Generate JWT Token
            var jwtSecret = _configuration["Jwt:Secret"] ?? "ecourt-tracker-super-secret-key-that-is-at-least-32-chars-long";
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(jwtSecret);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.Name, user.Username),
                    new Claim(ClaimTypes.Role, user.Role),
                    new Claim("userId", user.Id.ToString())
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            return Ok(new AuthResponse
            {
                Success = true,
                Message = "Login successful.",
                Token = tokenString,
                Username = user.Username,
                Role = user.Role
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during login");
            return StatusCode(500, new AuthResponse { Success = false, Message = "Internal server error during login." });
        }
    }
}
