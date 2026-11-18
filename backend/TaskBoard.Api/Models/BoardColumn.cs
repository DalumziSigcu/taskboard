namespace TaskBoard.Api.Models;

public class BoardColumn
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public double Position { get; set; }

    public Guid BoardId { get; set; }
    public Board Board { get; set; } = null!;

    public List<Card> Cards { get; set; } = new();
}