namespace TaskBoard.Api.Models;

public class BoardMember
{
    public Guid BoardId { get; set; }
    public Board Board { get; set; } = null!;

    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public BoardRole Role { get; set; } = BoardRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}