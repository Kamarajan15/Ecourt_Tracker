using System;

namespace ECourtScraperApi.Models;

public class FollowedCase
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string CnrNumber { get; set; } = string.Empty;
    public string CaseTitle { get; set; } = string.Empty;
    public string CaseStatus { get; set; } = string.Empty;
    public DateTime FollowedAt { get; set; } = DateTime.UtcNow;
}
