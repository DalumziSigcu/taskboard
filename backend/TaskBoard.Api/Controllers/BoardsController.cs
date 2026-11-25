using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Data;
using TaskBoard.Api.Dtos;
using TaskBoard.Api.Extensions;
using TaskBoard.Api.Models;
using TaskBoard.Api.Services;

namespace TaskBoard.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/boards")]
public class BoardsController(AppDbContext db, IBoardAccessService access) : ControllerBase
{
    private ObjectResult Forbidden(string message) =>
        StatusCode(StatusCodes.Status403Forbidden, new { message });

    private static bool TryParseRole(string? value, out BoardRole role) =>
        Enum.TryParse(value, true, out role) && Enum.IsDefined(role);

    // ---------- Boards ----------

    [HttpGet]
    public async Task<ActionResult<List<BoardSummaryDto>>> GetMine()
    {
        var userId = User.GetUserId();

        var rows = await db.BoardMembers
            .AsNoTracking()
            .Where(m => m.UserId == userId)
            .Select(m => new
            {
                m.Board.Id,
                m.Board.Name,
                m.Board.Description,
                m.Role,
                MemberCount = m.Board.Members.Count
            })
            .ToListAsync();

        return rows
            .OrderBy(r => r.Name)
            .Select(r => new BoardSummaryDto(r.Id, r.Name, r.Description, r.Role.ToString(), r.MemberCount))
            .ToList();
    }
    [HttpPost]
    public async Task<ActionResult<BoardSummaryDto>> Create(CreateBoardRequest request)
    {
        var userId = User.GetUserId();

        var board = new Board
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim()
        };

        board.Members.Add(new BoardMember { UserId = userId, Role = BoardRole.Owner });

        string[] defaultColumns = ["To Do", "In Progress", "Done"];
        for (var i = 0; i < defaultColumns.Length; i++)
        {
            board.Columns.Add(new BoardColumn
            {
                Id = Guid.NewGuid(),
                Name = defaultColumns[i],
                Position = (i + 1) * 1000
            });
        }

        db.Boards.Add(board);
        await db.SaveChangesAsync();

        var dto = new BoardSummaryDto(board.Id, board.Name, board.Description, BoardRole.Owner.ToString(), 1);
        return CreatedAtAction(nameof(Get), new { id = board.Id }, dto);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BoardDetailDto>> Get(Guid id)
    {
        var role = await access.GetRoleAsync(id, User.GetUserId());
        if (role is null) return NotFound();

        var board = await db.Boards
            .AsNoTracking()
            .Include(b => b.Members).ThenInclude(m => m.User)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (board is null) return NotFound();

        var members = board.Members
            .OrderByDescending(m => m.Role)
            .ThenBy(m => m.User.DisplayName)
            .Select(m => new MemberDto(m.UserId, m.User.Email, m.User.DisplayName, m.Role.ToString()))
            .ToList();

        return new BoardDetailDto(board.Id, board.Name, board.Description, role.Value.ToString(), members);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateBoardRequest request)
    {
        var role = await access.GetRoleAsync(id, User.GetUserId());
        if (role is null) return NotFound();
        if (role < BoardRole.Admin) return Forbidden("Only admins and the owner can edit a board.");

        var board = await db.Boards.FindAsync(id);
        if (board is null) return NotFound();

        board.Name = request.Name.Trim();
        board.Description = request.Description?.Trim();
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var role = await access.GetRoleAsync(id, User.GetUserId());
        if (role is null) return NotFound();
        if (role != BoardRole.Owner) return Forbidden("Only the owner can delete a board.");

        var board = await db.Boards.FindAsync(id);
        if (board is null) return NotFound();

        db.Boards.Remove(board);
        await db.SaveChangesAsync();

        return NoContent();
    }

    // ---------- Members ----------

    [HttpPost("{id:guid}/members")]
    public async Task<ActionResult<MemberDto>> AddMember(Guid id, AddMemberRequest request)
    {
        var myRole = await access.GetRoleAsync(id, User.GetUserId());
        if (myRole is null) return NotFound();
        if (myRole < BoardRole.Admin) return Forbidden("Only admins and the owner can add members.");

        if (!TryParseRole(request.Role, out var newRole))
            return BadRequest(new { message = "Role must be Viewer, Member or Admin." });
        if (newRole == BoardRole.Owner)
            return BadRequest(new { message = "A board's owner is the person who created it." });
        if (newRole >= myRole)
            return Forbidden("You can only assign roles below your own.");

        var email = request.Email.Trim().ToLowerInvariant();
        var target = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (target is null)
            return NotFound(new { message = "No registered user has that email." });

        var exists = await db.BoardMembers.AnyAsync(m => m.BoardId == id && m.UserId == target.Id);
        if (exists)
            return Conflict(new { message = "That user is already on this board." });

        db.BoardMembers.Add(new BoardMember { BoardId = id, UserId = target.Id, Role = newRole });
        await db.SaveChangesAsync();

        return Ok(new MemberDto(target.Id, target.Email, target.DisplayName, newRole.ToString()));
    }

    [HttpPut("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> ChangeRole(Guid id, Guid userId, ChangeRoleRequest request)
    {
        var myRole = await access.GetRoleAsync(id, User.GetUserId());
        if (myRole is null) return NotFound();
        if (myRole < BoardRole.Admin) return Forbidden("Only admins and the owner can change roles.");

        var target = await db.BoardMembers.FirstOrDefaultAsync(m => m.BoardId == id && m.UserId == userId);
        if (target is null) return NotFound();

        if (target.Role >= myRole)
            return Forbidden("You can't change the role of someone at or above your own level.");

        if (!TryParseRole(request.Role, out var newRole))
            return BadRequest(new { message = "Role must be Viewer, Member or Admin." });
        if (newRole == BoardRole.Owner)
            return BadRequest(new { message = "A board's owner is the person who created it." });
        if (newRole >= myRole)
            return Forbidden("You can only assign roles below your own.");

        target.Role = newRole;
        await db.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{userId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        var me = User.GetUserId();
        var myRole = await access.GetRoleAsync(id, me);
        if (myRole is null) return NotFound();

        var target = await db.BoardMembers.FirstOrDefaultAsync(m => m.BoardId == id && m.UserId == userId);
        if (target is null) return NotFound();

        if (userId == me)
        {
            if (myRole == BoardRole.Owner)
                return BadRequest(new { message = "The owner can't leave the board. Delete it instead." });
        }
        else
        {
            if (myRole < BoardRole.Admin) return Forbidden("Only admins and the owner can remove members.");
            if (target.Role >= myRole) return Forbidden("You can't remove someone at or above your own level.");
        }

        db.BoardMembers.Remove(target);
        await db.SaveChangesAsync();

        return NoContent();
    }
}

