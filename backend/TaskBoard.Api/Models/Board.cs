namespace TaskBoard.Api.Models;

public class Board
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<BoardMember> Members { get; set; } = new();
    public List<BoardColumn> Columns { get; set; } = new();
}