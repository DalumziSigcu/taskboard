using System.ComponentModel.DataAnnotations;

namespace TaskBoard.Api.Dtos;

public record RegisterRequest(
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(100)] string DisplayName,
    [Required, MinLength(8), MaxLength(100)] string Password);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record UserDto(Guid Id, string Email, string DisplayName);

public record AuthResponse(string Token, DateTime ExpiresAt, UserDto User);
