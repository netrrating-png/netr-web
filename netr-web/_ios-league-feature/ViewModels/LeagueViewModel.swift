// DESTINATION: ios/NETR/ViewModels/LeagueViewModel.swift
//
// Drives all league-account tab views.
// Shared via @Environment so every tab can read the same data.

import Foundation
import SwiftUI
import Supabase

@Observable
@MainActor
final class LeagueViewModel {

    // ── Published state ────────────────────────────────────────────────────
    var league: LeagueProfile?
    var teams: [LeagueTeam]        = []
    var games: [LeagueScheduledGame] = []
    var isLoading: Bool            = false
    var error: String?

    // Standings computed from games + teams
    var standings: [StandingRow]   = []

    // ── Private ────────────────────────────────────────────────────────────
    private let supabase = SupabaseClient(
        supabaseURL: URL(string: ProcessInfo.processInfo.environment["SUPABASE_URL"]
                         ?? Bundle.main.infoDictionary?["SUPABASE_URL"] as? String ?? "")!,
        supabaseKey: ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
                     ?? Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String ?? ""
    )

    // MARK: - Bootstrap

    /// Call once after the league account signs in.
    /// `profileLeagueId` comes from `profiles.league_id`.
    func load(profileLeagueId: String) async {
        isLoading = true
        error     = nil
        defer { isLoading = false }

        do {
            // 1. League profile
            let leagueData: LeagueProfile = try await SupabaseManager.shared.client
                .from("leagues")
                .select("id,name,slug,sport,season,location,description,logo_url,accent_color,is_active,app_account_id")
                .eq("id", value: profileLeagueId)
                .single()
                .execute()
                .value

            self.league = leagueData

            // 2. Teams
            let teamsData: [LeagueTeam] = try await SupabaseManager.shared.client
                .from("league_teams")
                .select("id,name,color,logo_url,crew_id,division_id")
                .eq("league_id", value: profileLeagueId)
                .order("name")
                .execute()
                .value
            self.teams = teamsData

            // 3. Upcoming + recent games (next 60 days + last 30)
            let after  = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-30*24*3600))
            let before = ISO8601DateFormatter().string(from: Date().addingTimeInterval(60*24*3600))
            let gamesData: [LeagueScheduledGame] = try await SupabaseManager.shared.client
                .from("league_games")
                .select("id,scheduled_at,location,status,home_score,away_score,game_type,home_team_id,away_team_id")
                .eq("league_id", value: profileLeagueId)
                .gte("scheduled_at", value: after)
                .lte("scheduled_at", value: before)
                .order("scheduled_at")
                .execute()
                .value
            self.games = gamesData

            computeStandings()

        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Standings

    func computeStandings() {
        var rows: [String: StandingRow] = [:]
        for team in teams {
            rows[team.id] = StandingRow(teamId: team.id, teamName: team.name, teamColor: team.teamColor)
        }
        for game in games where game.isCompleted {
            guard let hs = game.homeScore, let as_ = game.awayScore else { continue }
            if hs > as_ {
                rows[game.homeTeamId]?.wins += 1
                rows[game.awayTeamId]?.losses += 1
            } else if as_ > hs {
                rows[game.awayTeamId]?.wins += 1
                rows[game.homeTeamId]?.losses += 1
            }
            rows[game.homeTeamId]?.pointsFor     += hs
            rows[game.homeTeamId]?.pointsAgainst += as_
            rows[game.awayTeamId]?.pointsFor     += as_
            rows[game.awayTeamId]?.pointsAgainst += hs
        }
        standings = rows.values.sorted { $0.wins != $1.wins ? $0.wins > $1.wins : $0.pointDiff > $1.pointDiff }
    }

    // MARK: - Helpers

    func teamName(for id: String) -> String {
        teams.first(where: { $0.id == id })?.name ?? "TBD"
    }

    func team(for id: String) -> LeagueTeam? {
        teams.first(where: { $0.id == id })
    }
}

// MARK: - Standing row

struct StandingRow: Identifiable {
    let teamId:   String
    let teamName: String
    let teamColor: Color
    var wins:          Int = 0
    var losses:        Int = 0
    var pointsFor:     Int = 0
    var pointsAgainst: Int = 0

    var id: String { teamId }
    var pointDiff:    Int    { pointsFor - pointsAgainst }
    var gamesPlayed:  Int    { wins + losses }
    var winPct:       Double { gamesPlayed == 0 ? 0 : Double(wins) / Double(gamesPlayed) }
    var record:       String { "\(wins)–\(losses)" }
}
