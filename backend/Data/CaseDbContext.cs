using Microsoft.EntityFrameworkCore;
using ECourtScraperApi.Models;
using System.Text.Json;

namespace ECourtScraperApi.Data;

public class CaseDbContext : DbContext
{
    public CaseDbContext(DbContextOptions<CaseDbContext> options) : base(options)
    {
    }

    public DbSet<CaseData> Cases => Set<CaseData>();
    public DbSet<SearchLog> SearchLogs => Set<SearchLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure CaseData
        modelBuilder.Entity<CaseData>(entity =>
        {
            entity.HasKey(c => c.CnrNumber);

            var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

            entity.Property(c => c.Petitioners)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<string>>(v, jsonOptions) ?? new List<string>())
                .HasColumnType("jsonb");

            entity.Property(c => c.Respondents)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<string>>(v, jsonOptions) ?? new List<string>())
                .HasColumnType("jsonb");

            entity.Property(c => c.Acts)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<string>>(v, jsonOptions) ?? new List<string>())
                .HasColumnType("jsonb");

            entity.Property(c => c.Hearings)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<HearingHistory>>(v, jsonOptions) ?? new List<HearingHistory>())
                .HasColumnType("jsonb");

            entity.Property(c => c.Orders)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<OrderDetails>>(v, jsonOptions) ?? new List<OrderDetails>())
                .HasColumnType("jsonb");

            entity.Property(c => c.Processes)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<ProcessDetail>>(v, jsonOptions) ?? new List<ProcessDetail>())
                .HasColumnType("jsonb");

            entity.Property(c => c.TransferDetails)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<TransferDetail>>(v, jsonOptions) ?? new List<TransferDetail>())
                .HasColumnType("jsonb");

            entity.Property(c => c.IAStatuses)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOptions),
                    v => JsonSerializer.Deserialize<List<IAStatus>>(v, jsonOptions) ?? new List<IAStatus>())
                .HasColumnType("jsonb");
        });

        // Configure SearchLog
        modelBuilder.Entity<SearchLog>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.Property(s => s.CnrNumber).IsRequired();
            entity.Property(s => s.SearchTime).IsRequired();
            entity.Property(s => s.IsSuccess).IsRequired();
            entity.Property(s => s.IsAutomated).IsRequired();
        });
    }
}
