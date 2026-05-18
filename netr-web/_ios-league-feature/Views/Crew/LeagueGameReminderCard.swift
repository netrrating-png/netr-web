// DESTINATION: ios/NETR/Views/Crews/LeagueGameReminderCard.swift
//
// Rendered inside CrewChatView when message.messageType == "league_game_reminder".
// Shows league branding, game info, and IN/OUT/MAYBE RSVP buttons — reusing
// the existing crew_poll_responses table exactly like game invites do.

import SwiftUI

struct LeagueGameReminderCard: View {
    let message:       CrewMessage
    let viewModel:     CrewViewModel
    let currentUserId: String

    @State private var leagueGame: LeagueReminderDetail? = nil
    @State private var isLoading = false

    private var myResponse: String? {
        viewModel.pollResponse(for: message.id, userId: currentUserId)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // ── League header ──────────────────────────────────────────────
            leagueHeader

            Divider().background(Color.white.opacity(0.08))

            // ── Game details ───────────────────────────────────────────────
            if let game = leagueGame {
                gameDetails(game)
            } else if isLoading {
                HStack { Spacer(); ProgressView().tint(.white.opacity(0.5)); Spacer() }
                    .padding(.vertical, 14)
            } else {
                // Fallback: render the message content text
                Text(message.content)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.85))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
            }

            Divider().background(Color.white.opacity(0.08))

            // ── RSVP buttons ───────────────────────────────────────────────
            rsvpButtons
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(leagueGame?.accentColor.flatMap { Color(hex: $0) }?.opacity(0.15)
                      ?? Color.white.opacity(0.06))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(leagueGame?.accentColor.flatMap { Color(hex: $0) }?.opacity(0.35)
                        ?? Color.white.opacity(0.12),
                        lineWidth: 1)
        )
        .task {
            await loadGameDetail()
        }
    }

    // MARK: - League Header

    private var leagueHeader: some View {
        HStack(spacing: 10) {
            // League logo or sport icon
            if let logo = leagueGame?.leagueLogoUrl {
                AsyncImage(url: URL(string: logo)) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Circle().fill(Color.white.opacity(0.12))
                }
                .frame(width: 32, height: 32)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            } else {
                Image(systemName: "basketball.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(leagueGame?.accentColor.flatMap { Color(hex: $0) } ?? NETRTheme.neonGreen)
                    .frame(width: 32, height: 32)
                    .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(leagueGame?.leagueName ?? "League Reminder")
                    .font(.system(.subheadline, weight: .bold))
                    .foregroundStyle(.white)
                Text("GAME REMINDER · 3 DAYS")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(leagueGame?.accentColor.flatMap { Color(hex: $0) } ?? NETRTheme.neonGreen)
                    .tracking(1.5)
            }

            Spacer()

            Image(systemName: "bell.fill")
                .font(.system(size: 13))
                .foregroundStyle(leagueGame?.accentColor.flatMap { Color(hex: $0) }?.opacity(0.8) ?? NETRTheme.neonGreen.opacity(0.8))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    // MARK: - Game Details

    private func gameDetails(_ game: LeagueReminderDetail) -> some View {
        VStack(spacing: 10) {
            // Matchup
            HStack(spacing: 8) {
                teamChip(name: game.homeTeamName, color: game.homeTeamColor)
                Text("VS")
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(.white.opacity(0.4))
                teamChip(name: game.awayTeamName, color: game.awayTeamColor)
            }
            .frame(maxWidth: .infinity)

            // Date + time
            if let date = game.scheduledDate {
                let dateStr = date.formatted(.dateTime.weekday(.wide).month(.abbreviated).day())
                let timeStr = date.formatted(.dateTime.hour().minute())
                HStack(spacing: 16) {
                    Label(dateStr, systemImage: "calendar")
                    Label(timeStr, systemImage: "clock")
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white.opacity(0.7))
            }

            // Location
            if let loc = game.location {
                Label(loc, systemImage: "mappin.circle.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 14)
    }

    private func teamChip(name: String, color: String?) -> some View {
        HStack(spacing: 5) {
            Circle()
                .fill(color.flatMap { Color(hex: $0) } ?? Color.white.opacity(0.3))
                .frame(width: 8, height: 8)
            Text(name)
                .font(.system(.caption, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .padding(.horizontal, 10).padding(.vertical, 5)
        .background(Color.white.opacity(0.08), in: Capsule())
        .frame(maxWidth: .infinity)
    }

    // MARK: - RSVP Buttons

    private var rsvpButtons: some View {
        HStack(spacing: 0) {
            ForEach([("in","✅ IN"), ("maybe","🤔 MAYBE"), ("out","❌ OUT")], id: \.0) { val, label in
                Button {
                    Task {
                        await viewModel.submitPollResponse(
                            messageId: message.id,
                            crewId: message.crewId,
                            response: val
                        )
                    }
                } label: {
                    VStack(spacing: 2) {
                        Text(label)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(myResponse == val ? .black : .white.opacity(0.75))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(myResponse == val
                        ? (leagueGame?.accentColor.flatMap { Color(hex: $0) } ?? NETRTheme.neonGreen)
                        : Color.white.opacity(0.05))
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 0))
        .clipShape(.rect(bottomLeadingRadius: 15, bottomTrailingRadius: 15))
    }

    // MARK: - Data loading

    private func loadGameDetail() async {
        guard let gameId = message.leagueGameId else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let detail: LeagueReminderDetail = try await SupabaseManager.shared.client
                .from("league_games")
                .select("""
                    id, scheduled_at, location,
                    leagues ( name, accent_color, logo_url ),
                    home_team:league_teams!home_team_id ( name, color ),
                    away_team:league_teams!away_team_id ( name, color )
                """)
                .eq("id", value: gameId)
                .single()
                .execute()
                .value
            leagueGame = detail
        } catch { /* silently fail — content text is the fallback */ }
    }
}

// MARK: - Detail model for the reminder card

struct LeagueReminderDetail: Decodable {
    struct LeagueRef:   Decodable { let name: String; let accentColor: String?; let logoUrl: String?
        enum CodingKeys: String, CodingKey { case name; case accentColor = "accent_color"; case logoUrl = "logo_url" }
    }
    struct TeamRef:     Decodable { let name: String; let color: String? }

    let id:           String
    let scheduledAt:  String
    let location:     String?
    let leagues:      LeagueRef?
    let homeTeam:     TeamRef?
    let awayTeam:     TeamRef?

    enum CodingKeys: String, CodingKey {
        case id; case scheduledAt = "scheduled_at"; case location
        case leagues; case homeTeam = "home_team"; case awayTeam = "away_team"
    }

    var leagueName:    String  { leagues?.name ?? "" }
    var accentColor:   String? { leagues?.accentColor }
    var leagueLogoUrl: String? { leagues?.logoUrl }
    var homeTeamName:  String  { homeTeam?.name ?? "Home" }
    var homeTeamColor: String? { homeTeam?.color }
    var awayTeamName:  String  { awayTeam?.name ?? "Away" }
    var awayTeamColor: String? { awayTeam?.color }
    var scheduledDate: Date?   { ISO8601DateFormatter().date(from: scheduledAt) }
}
