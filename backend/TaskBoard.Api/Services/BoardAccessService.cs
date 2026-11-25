using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Models;

namespace TaskBoard.Api.Services;

public interface IBoardAccessService
{
    Task<BoardRole?> GetRoleAsync(Guid boardId, Guid userId);
}

public class BoardAccessService(AppDbContext db) : IBoardAccessService
{
    public async Task<BoardRole?> GetRoleAsync(Guid boardId, Guid userId)
    {
        var membership = await db.BoardMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.BoardId == boardId && m.UserId == userId);

        return membership?.Role;
    }
}
