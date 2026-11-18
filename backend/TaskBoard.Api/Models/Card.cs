namespace TaskBoard.Api.Models;

public class Card
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public double Position { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid ColumnId { get; set; }
    public BoardColumn Column { get; set; } = null!;

    public Guid? AssigneeId { get; set; }
    public User? Assignee { get; set; }
}