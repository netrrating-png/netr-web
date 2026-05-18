# iOS League Feature — Integration Patches

These are the exact changes needed to existing files.
Apply them after copying the new files above into the project.

---

## 1. `ios/NETR/Models/UserProfile.swift`

Add two properties to the `UserProfile` struct (after the existing properties):

```swift
// League account support
var isLeagueAccount: Bool
var leagueId: String?
```

Add to CodingKeys enum:
```swift
case isLeagueAccount = "is_league_account"
case leagueId        = "league_id"
```

Add defaults in the init (if you have a memberwise or default init):
```swift
isLeagueAccount = false
leagueId        = nil
```

---

## 2. `ios/NETR/Models/CrewModels.swift`

Add two properties to the `CrewMessage` struct:

```swift
var leagueGameId: String?
var leagueId:     String?
```

Add to CrewMessage.CodingKeys:
```swift
case leagueGameId = "league_game_id"
case leagueId     = "league_id"
```

Add a computed var:
```swift
var isLeagueGameReminder: Bool { messageType == "league_game_reminder" }
```

---

## 3. `ios/NETR/Views/RootView.swift`

In the `else` branch that shows `ContentView()`, add a check for league accounts:

**Before:**
```swift
} else {
    ContentView()
        .transition(.opacity)
        ...
}
```

**After:**
```swift
} else if supabase.currentProfile?.isLeagueAccount == true {
    LeagueTabView()
        .transition(.opacity)
} else {
    ContentView()
        .transition(.opacity)
        ...
}
```

---

## 4. `ios/NETR/Views/Crews/CrewChatView.swift`

In the message bubble renderer, add handling for `league_game_reminder` alongside the existing `game_invite` check:

**Find the block that checks `message.isGameInvite` and add:**

```swift
if message.isLeagueGameReminder {
    // League reminder card
    LeagueGameReminderCard(
        message:       message,
        viewModel:     viewModel,
        currentUserId: currentUserId
    )
    .padding(.horizontal, 8)
} else if message.isGameInvite {
    // existing GameInviteCardView(...)
    GameInviteCardView(message: message, viewModel: viewModel, currentUserId: currentUserId)
} else {
    // existing normal text bubble
}
```

---

## 5. `ios/NETR/Views/CourtDetailView.swift`

### Add state vars (near the `courtScheduledGames` declarations):

```swift
@State private var leagueCourtGames: [LeagueCourtGame] = []
@State private var isLoadingLeagueGames: Bool = false
```

### Add to `loadCourtGames()` (or create it if called separately):

```swift
private func loadLeagueGames() async {
    isLoadingLeagueGames = true
    defer { isLoadingLeagueGames = false }
    do {
        let games: [LeagueCourtGame] = try await SupabaseManager.shared.client
            .from("league_games_for_courts")
            .select("*")
            .eq("court_id", value: court.id)
            .order("scheduled_at")
            .execute()
            .value
        leagueCourtGames = games
    } catch { /* non-fatal */ }
}
```

Call `await loadLeagueGames()` inside your `.task {}` or `.onAppear {}` alongside `loadCourtGames()`.

### Add a "League Games" section inside the Games tab content:

Find where `courtScheduledGames` is displayed and add AFTER it:

```swift
// ── League Games ───────────────────────────────────────
if !leagueCourtGames.isEmpty {
    VStack(alignment: .leading, spacing: 8) {
        Text("LEAGUE GAMES")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(NETRTheme.muted)
            .tracking(2)
            .padding(.horizontal, 16)

        ForEach(leagueCourtGames) { game in
            LeagueCourtGameRow(game: game)
                .padding(.horizontal, 16)
        }
    }
    .padding(.top, 8)
}
```

### Add the `LeagueCourtGameRow` view (can go at the bottom of CourtDetailView.swift):

```swift
private struct LeagueCourtGameRow: View {
    let game: LeagueCourtGame

    private static let fmt: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .short
        f.timeStyle = .short
        return f
    }()

    var body: some View {
        HStack(spacing: 12) {
            // League color accent bar
            Rectangle()
                .fill(game.color)
                .frame(width: 4)
                .clipShape(Capsule())

            VStack(alignment: .leading, spacing: 3) {
                // League name badge
                Text(game.leagueName.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(game.color)
                    .tracking(1.5)

                // Matchup
                let home = game.homeTeamName ?? "Home"
                let away = game.awayTeamName ?? "Away"
                Text("\(home)  vs  \(away)")
                    .font(.system(.subheadline, weight: .semibold))
                    .foregroundStyle(NETRTheme.text)

                // Date/time
                if let date = game.scheduledDate {
                    Text(Self.fmt.string(from: date))
                        .font(.caption)
                        .foregroundStyle(NETRTheme.subtext)
                }
            }

            Spacer()

            // Sport tag
            Text(game.sport?.capitalized ?? "League")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(game.color)
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(game.color.opacity(0.12), in: Capsule())
        }
        .padding(12)
        .background(NETRTheme.card, in: RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(game.color.opacity(0.3), lineWidth: 1)
        )
    }
}
```

---

## 6. Supabase RPC: `league_stat_leaders`

Add this function in Supabase SQL editor — required for `LeagueStatsView`:

```sql
create or replace function league_stat_leaders(p_league_id uuid)
returns table (
  display_name text,
  team_name    text,
  points       double precision,
  assists      double precision,
  rebounds     double precision,
  steals       double precision,
  blocks       double precision,
  games_played bigint
)
language sql stable as $$
  select
    lp.display_name,
    lt.name                              as team_name,
    round(avg(s.points)::numeric, 1)    as points,
    round(avg(s.assists)::numeric, 1)   as assists,
    round(avg(s.rebounds)::numeric, 1)  as rebounds,
    round(avg(s.steals)::numeric, 1)    as steals,
    round(avg(s.blocks)::numeric, 1)    as blocks,
    count(*)                            as games_played
  from league_player_stats s
  join league_players lp on s.player_id = lp.id
  join league_teams   lt on lp.team_id  = lt.id
  where lt.league_id = p_league_id
  group by lp.id, lp.display_name, lt.name
  having count(*) >= 1
  order by points desc;
$$;
grant execute on function league_stat_leaders(uuid) to anon, authenticated;
```
