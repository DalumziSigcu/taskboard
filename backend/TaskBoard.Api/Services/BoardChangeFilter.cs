using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using TaskBoard.Api.Hubs;

namespace TaskBoard.Api.Services;

public class BoardChangeFilter(IHubContext<BoardHub> hub) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var executed = await next();

        if (HttpMethods.IsGet(context.HttpContext.Request.Method) || executed.Exception is not null)
            return;

        var code = (executed.Result as IStatusCodeActionResult)?.StatusCode ?? 200;
        if (code < 200 || code >= 300) return;

        var values = context.RouteData.Values;
        object? raw = null;
        if (!values.TryGetValue("boardId", out raw)) values.TryGetValue("id", out raw);
        if (!Guid.TryParse(raw?.ToString(), out var boardId)) return;

        var path = context.HttpContext.Request.Path.Value ?? "";
        var kind = path.Contains("/members") ? "members"
            : path.Contains("/cards") || path.Contains("/columns") ? "content"
            : "board";

        await hub.Clients.Group(BoardHub.GroupName(boardId))
            .SendAsync("BoardChanged", new { boardId, kind });
    }
}
