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
[Route("api/boards/{boardId:guid}")]
public class BoardContentController(AppDbContext db, IBoardAccessService access) : ControllerBase
{
    private async Task<ActionResult?> CheckAccessAsync(Guid boardId, BoardRole minimum)
    {
        var role = await access.GetRoleAsync(boardId, User.GetUserId());
        if (role is null) return NotFound();
        if (role < minimum)
            return StatusCode(StatusCodes.Status403Forbidden,
                new { message = $"This needs the {minimum} role or higher." });
        return null;
    }

    private static CardDto ToDto(Card c) =>
        new(c.Id, c.Title, c.Description, c.Position, c.DueDate, c.ColumnId, c.AssigneeId);

    private Task<bool> IsMemberAsync(Guid boardId, Guid userId) =>
        db.BoardMembers.AnyAsync(m => m.BoardId == boardId && m.UserId == userId);

    // ---------- Columns ----------

    [HttpGet("columns")]
    public async Task<ActionResult<List<ColumnDto>>> GetColumns(Guid boardId)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Viewer) is { } denied) return denied;

        var columns = await db.BoardColumns
            .AsNoTracking()
            .Where(c => c.BoardId == boardId)
            .Include(c => c.Cards)
            .ToListAsync();

        return columns
            .OrderBy(c => c.Position)
            .Select(c => new ColumnDto(
                c.Id, c.Name, c.Position,
                c.Cards.OrderBy(k => k.Position).Select(ToDto).ToList()))
            .ToList();
    }

    [HttpPost("columns")]
    public async Task<ActionResult<ColumnDto>> CreateColumn(Guid boardId, CreateColumnRequest request)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Admin) is { } denied) return denied;

        var last = await db.BoardColumns
            .Where(c => c.BoardId == boardId)
            .MaxAsync(c => (double?)c.Position);

        var column = new BoardColumn
        {
            Id = Guid.NewGuid(),
            BoardId = boardId,
            Name = request.Name.Trim(),
            Position = (last ?? 0) + 1000
        };

        db.BoardColumns.Add(column);
        await db.SaveChangesAsync();

        return Ok(new ColumnDto(column.Id, column.Name, column.Position, new List<CardDto>()));
    }

    [HttpPut("columns/{columnId:guid}")]
    public async Task<IActionResult> RenameColumn(Guid boardId, Guid columnId, RenameColumnRequest request)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Admin) is { } denied) return denied;

        var column = await db.BoardColumns.FirstOrDefaultAsync(c => c.Id == columnId && c.BoardId == boardId);
        if (column is null) return NotFound();

        column.Name = request.Name.Trim();
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("columns/{columnId:guid}")]
    public async Task<IActionResult> DeleteColumn(Guid boardId, Guid columnId)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Admin) is { } denied) return denied;

        var column = await db.BoardColumns.FirstOrDefaultAsync(c => c.Id == columnId && c.BoardId == boardId);
        if (column is null) return NotFound();

        db.BoardColumns.Remove(column);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("columns/{columnId:guid}/move")]
    public async Task<IActionResult> MoveColumn(Guid boardId, Guid columnId, MoveColumnRequest request)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Admin) is { } denied) return denied;

        var column = await db.BoardColumns.FirstOrDefaultAsync(c => c.Id == columnId && c.BoardId == boardId);
        if (column is null) return NotFound();

        var siblings = await db.BoardColumns
            .Where(c => c.BoardId == boardId && c.Id != columnId)
            .OrderBy(c => c.Position)
            .ToListAsync();

        var index = Math.Min(request.Index, siblings.Count);
        column.Position = Ordering.PositionAt(siblings.Select(s => s.Position).ToList(), index);

        siblings.Insert(index, column);
        if (Ordering.NeedsRebalance(siblings.Select(s => s.Position).ToList()))
            Ordering.Renumber(siblings, (c, p) => c.Position = p);

        await db.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Cards ----------

    [HttpPost("columns/{columnId:guid}/cards")]
    public async Task<ActionResult<CardDto>> CreateCard(Guid boardId, Guid columnId, CreateCardRequest request)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Member) is { } denied) return denied;

        var columnExists = await db.BoardColumns.AnyAsync(c => c.Id == columnId && c.BoardId == boardId);
        if (!columnExists) return NotFound();

        if (request.AssigneeId is { } assignee && !await IsMemberAsync(boardId, assignee))
            return BadRequest(new { message = "The assignee must be a member of this board." });

        var last = await db.Cards
            .Where(c => c.ColumnId == columnId)
            .MaxAsync(c => (double?)c.Position);

        var card = new Card
        {
            Id = Guid.NewGuid(),
            ColumnId = columnId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            DueDate = request.DueDate,
            AssigneeId = request.AssigneeId,
            Position = (last ?? 0) + 1000
        };

        db.Cards.Add(card);
        await db.SaveChangesAsync();

        return Ok(ToDto(card));
    }

    [HttpPut("cards/{cardId:guid}")]
    public async Task<IActionResult> UpdateCard(Guid boardId, Guid cardId, UpdateCardRequest request)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Member) is { } denied) return denied;

        var card = await db.Cards.FirstOrDefaultAsync(c => c.Id == cardId && c.Column.BoardId == boardId);
        if (card is null) return NotFound();

        if (request.AssigneeId is { } assignee && !await IsMemberAsync(boardId, assignee))
            return BadRequest(new { message = "The assignee must be a member of this board." });

        card.Title = request.Title.Trim();
        card.Description = request.Description?.Trim();
        card.DueDate = request.DueDate;
        card.AssigneeId = request.AssigneeId;

        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("cards/{cardId:guid}")]
    public async Task<IActionResult> DeleteCard(Guid boardId, Guid cardId)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Member) is { } denied) return denied;

        var card = await db.Cards.FirstOrDefaultAsync(c => c.Id == cardId && c.Column.BoardId == boardId);
        if (card is null) return NotFound();

        db.Cards.Remove(card);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("cards/{cardId:guid}/move")]
    public async Task<IActionResult> MoveCard(Guid boardId, Guid cardId, MoveCardRequest request)
    {
        if (await CheckAccessAsync(boardId, BoardRole.Member) is { } denied) return denied;

        var card = await db.Cards.FirstOrDefaultAsync(c => c.Id == cardId && c.Column.BoardId == boardId);
        if (card is null) return NotFound();

        var target = await db.BoardColumns
            .FirstOrDefaultAsync(c => c.Id == request.ColumnId && c.BoardId == boardId);
        if (target is null)
            return NotFound(new { message = "The target column isn't on this board." });

        var siblings = await db.Cards
            .Where(c => c.ColumnId == target.Id && c.Id != card.Id)
            .OrderBy(c => c.Position)
            .ToListAsync();

        var index = Math.Min(request.Index, siblings.Count);
        card.ColumnId = target.Id;
        card.Position = Ordering.PositionAt(siblings.Select(s => s.Position).ToList(), index);

        siblings.Insert(index, card);
        if (Ordering.NeedsRebalance(siblings.Select(s => s.Position).ToList()))
            Ordering.Renumber(siblings, (c, p) => c.Position = p);

        await db.SaveChangesAsync();
        return NoContent();
    }
}
