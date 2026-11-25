namespace TaskBoard.Api.Services;

public static class Ordering
{
    private const double Step = 1000;
    private const double MinGap = 0.0001;

    // `sorted` = positions of the OTHER items in the list, ascending (the moved item excluded).
    public static double PositionAt(IReadOnlyList<double> sorted, int index)
    {
        if (sorted.Count == 0) return Step;
        if (index <= 0) return sorted[0] - Step;
        if (index >= sorted.Count) return sorted[sorted.Count - 1] + Step;
        return (sorted[index - 1] + sorted[index]) / 2;
    }

    public static bool NeedsRebalance(IReadOnlyList<double> sorted)
    {
        for (var i = 1; i < sorted.Count; i++)
        {
            if (sorted[i] - sorted[i - 1] < MinGap) return true;
        }
        return false;
    }

    public static void Renumber<T>(IList<T> items, Action<T, double> setPosition)
    {
        for (var i = 0; i < items.Count; i++)
        {
            setPosition(items[i], (i + 1) * Step);
        }
    }
}
