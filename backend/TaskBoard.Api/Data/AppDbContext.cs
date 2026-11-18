using Microsoft.EntityFrameworkCore;
using TaskBoard.Api.Models;

namespace TaskBoard.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<BoardMember> BoardMembers => Set<BoardMember>();
    public DbSet<BoardColumn> BoardColumns => Set<BoardColumn>();
    public DbSet<Card> Cards => Set<Card>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.Email).HasMaxLength(256).IsRequired();
            e.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
            e.Property(u => u.PasswordHash).IsRequired();
        });

        modelBuilder.Entity<Board>(e =>
        {
            e.Property(b => b.Name).HasMaxLength(100).IsRequired();
            e.Property(b => b.Description).HasMaxLength(500);
        });

        modelBuilder.Entity<BoardMember>(e =>
        {
            e.HasKey(m => new { m.BoardId, m.UserId });
            e.Property(m => m.Role).HasConversion<string>().HasMaxLength(20);

            e.HasOne(m => m.Board)
                .WithMany(b => b.Members)
                .HasForeignKey(m => m.BoardId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(m => m.User)
                .WithMany(u => u.Memberships)
                .HasForeignKey(m => m.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BoardColumn>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(100).IsRequired();

            e.HasOne(c => c.Board)
                .WithMany(b => b.Columns)
                .HasForeignKey(c => c.BoardId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Card>(e =>
        {
            e.Property(c => c.Title).HasMaxLength(200).IsRequired();
            e.Property(c => c.Description).HasMaxLength(2000);

            e.HasOne(c => c.Column)
                .WithMany(col => col.Cards)
                .HasForeignKey(c => c.ColumnId)
                .OnDelete(DeleteBehavior.Cascade);

            // SetNull avoids SQL Server's "multiple cascade paths" error
            // and keeps the card if its assignee's account is deleted.
            e.HasOne(c => c.Assignee)
                .WithMany()
                .HasForeignKey(c => c.AssigneeId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}