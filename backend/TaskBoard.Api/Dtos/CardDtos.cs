using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public record CardDto(
    Guid Id, string Title, string? Description, double Position,
    DateTime? DueDate, Guid ColumnId, Guid? AssigneeId);

public record ColumnDto(Guid Id, string Name, double Position, List<CardDto> Cards);

public record CreateColumnRequest([Required, MaxLength(100)] string Name);

public record RenameColumnRequest([Required, MaxLength(100)] string Name);

public record MoveColumnRequest([Range(0, int.MaxValue)] int Index);

public record CreateCardRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description,
    DateTime? DueDate,
    Guid? AssigneeId);

public record UpdateCardRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(2000)] string? Description,
    DateTime? DueDate,
    Guid? AssigneeId);

public record MoveCardRequest(Guid ColumnId, [Range(0, int.MaxValue)] int Index);
