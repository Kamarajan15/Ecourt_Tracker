namespace ECourtScraperApi.Models;

public class SearchRequest
{
    public string SessionId { get; set; } = string.Empty;
    public string CnrNumber { get; set; } = string.Empty;
    public string Captcha { get; set; } = string.Empty;
    public bool ForceRefresh { get; set; } = false;
}

public class AutoSearchRequest
{
    public string CnrNumber { get; set; } = string.Empty;
    public bool ForceRefresh { get; set; } = false;
}

public class CaseDetailsResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public CaseData? CaseDetails { get; set; }

    // Fallback logic fields
    public bool RequiresManualInput { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string CaptchaBase64 { get; set; } = string.Empty;
}

public class CaseData
{
    public string CnrNumber { get; set; } = string.Empty;
    public string CaseType { get; set; } = string.Empty;
    public string FilingNumber { get; set; } = string.Empty;
    public string FilingDate { get; set; } = string.Empty;
    public string RegistrationNumber { get; set; } = string.Empty;
    public string RegistrationDate { get; set; } = string.Empty;

    public string CaseStatus { get; set; } = string.Empty;
    public string FirstHearingDate { get; set; } = string.Empty;
    public string NextHearingDate { get; set; } = string.Empty;
    public string DecisionDate { get; set; } = string.Empty;
    public string CaseTitle { get; set; } = string.Empty;

    public List<string> Petitioners { get; set; } = new();
    public List<string> Respondents { get; set; } = new();
    public string PetitionerAdvocate { get; set; } = string.Empty;
    public string RespondentAdvocate { get; set; } = string.Empty;

    public string CourtEstablishment { get; set; } = string.Empty;
    public string Judge { get; set; } = string.Empty;

    public List<string> Acts { get; set; } = new();
    public List<HearingHistory> Hearings { get; set; } = new();
    public List<OrderDetails> Orders { get; set; } = new();
    public List<ProcessDetail> Processes { get; set; } = new();
    public List<TransferDetail> TransferDetails { get; set; } = new();
    public List<IAStatus> IAStatuses { get; set; } = new();
}

public class HearingHistory
{
    public string Judge { get; set; } = string.Empty;
    public string BusinessOnDate { get; set; } = string.Empty;
    public string HearingDate { get; set; } = string.Empty;
    public string Purpose { get; set; } = string.Empty;
}

public class OrderDetails
{
    public string OrderDate { get; set; } = string.Empty;
    public string OrderNumber { get; set; } = string.Empty;
}

public class ProcessDetail
{
    public string ProcessId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
}

public class TransferDetail
{
    public string RegistrationNumber { get; set; } = string.Empty;
    public string TransferDate { get; set; } = string.Empty;
    public string FromCourt { get; set; } = string.Empty;
    public string ToCourt { get; set; } = string.Empty;
}

public class IAStatus
{
    public string IANumber { get; set; } = string.Empty;
    public string PartyName { get; set; } = string.Empty;
    public string FilingDate { get; set; } = string.Empty;
    public string NextDate { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class SearchLog
{
    public int Id { get; set; }
    public string CnrNumber { get; set; } = string.Empty;
    public DateTime SearchTime { get; set; } = DateTime.UtcNow;
    public bool IsSuccess { get; set; }
    public bool IsAutomated { get; set; }
    public string Message { get; set; } = string.Empty;
    public string CaseTitle { get; set; } = string.Empty;
    public string CaseType { get; set; } = string.Empty;
}

