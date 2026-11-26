using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using TaskBoard.Api.Extensions;
using TaskBoard.Api.Services;

namespace TaskBoard.Api.Hubs;

[Authorize]
public class BoardHub(IBoardAccessService access) : Hub
{
    public static string GroupName(Guid boardId) => $"board-{boardId}";

    public async Task JoinBoard(Guid boardId)
    {
        var role = await access.GetRoleAsync(boardId, Context.User!.GetUserId());
        if (role is null) throw new HubException("You are not a member of this board.");

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(boardId));
    }

    public Task LeaveBoard(Guid boardId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(boardId));
}
