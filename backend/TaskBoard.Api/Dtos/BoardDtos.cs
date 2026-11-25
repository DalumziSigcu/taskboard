using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public record CreateBoardRequest(
    [Required, MaxLength(100)] string Name,
    [MaxLength(500)] string? Description);

public record UpdateBoardRequest(
    [Required, MaxLength(100)] string Name,
    [MaxLength(500)] string? Description);

public record AddMemberRequest(
    [Required, EmailAddress] string Email,
    [Required] string Role);

public record ChangeRoleRequest([Required] string Role);

public record BoardSummaryDto(Guid Id, string Name, string? Description, string Role, int MemberCount);

public record MemberDto(Guid UserId, string Email, string DisplayName, string Role);

public record BoardDetailDto(Guid Id, string Name, string? Description, string MyRole, List<MemberDto> Members);
