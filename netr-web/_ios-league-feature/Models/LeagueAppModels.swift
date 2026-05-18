// DESTINATION: ios/NETR/Models/LeagueAppModels.swift
//
// Models for the league app account experience:
//   - LeagueCourtGame   : league game shown on the courts page
//   - LeagueProfile     : lightweight profile for a league account
//   - LeagueReminderInfo: data embedded in a league_game_reminder message

import Foundation
import SwiftUI

// MARK: - League game surfaced on the courts page
// Decoded from the `league_games_for_courts` Supabase view.

nonisolated struct LeagueCourtGame: Identifiable, Decodable, Sendable {
    let id: String
    let courtId: String
    let scheduledAt: String
    let status: String
    let leagueId: String
    let leagueName: String
    let accentColor: String?      // hex, e.g. "#39FF14"
    let leagueLogoUrl: String?
    let sport: String?
    let homeTeamId: String?
    let homeTeamName: String?
    let homeTeamColor: String?
    let homeTeamLogoUrl: String?
    let awayTeamId: String?
    let awayTeamName: String?
    let awayTeamColor: String?
    let awayTeamLogoUrl: String?

    nonisolated enum CodingKeys: String, CodingKey {
        case id
        case courtId         = "court_id"
        case scheduledAt     = "scheduled_at"
        case status
        case leagueId        = "league_id"
        case leagueName      = "league_name"
        case accentColor     = "accent_color"
        case leagueLogoUrl   = "league_logo_url"
        case sport
        case homeTeamId      = "home_team_id"
        case homeTeamName    = "home_team_name"
        case homeTeamColor   = "home_team_color"
        case homeTeamLogoUrl = "home_team_logo_url"
        case awayTeamId      = "away_team_id"
        case awayTeamName    = "away_team_name"
        case awayTeamColor   = "away_team_color"
        case awayTeamLogoUrl = "away_team_logo_url"
    }

    /// Parsed SwiftUI Color from the league's accent_color hex string.
    var color: Color {
        guard let hex = accentColor else { return NETRTheme.neonGreen }
        return Color(hex: hex) ?? NETRTheme.neonGreen
    }

    var scheduledDate: Date? {
        ISO8601DateFormatter().date(from: scheduledAt)
    }
}

// MARK: - League profile (fetched by the league app account on sign-in)

nonisolated struct LeagueProfile: Decodable, Sendable {
    let id: String               // leagues.id (UUID)
    let name: String
    let slug: String
    let sport: String
    let season: String?
    let location: String?
    let description: String?
    let logoUrl: String?
    let accentColor: String?
    let isActive: Bool
    let appAccountId: String?    // profiles.id of the league account

    nonisolated enum CodingKeys: String, CodingKey {
        case id, name, slug, sport, season, location, description
        case logoUrl       = "logo_url"
        case accentColor   = "accent_color"
        case isActive      = "is_active"
        case appAccountId  = "app_account_id"
    }

    var color: Color {
        guard let hex = accentColor else { return NETRTheme.neonGreen }
        return Color(hex: hex) ?? NETRTheme.neonGreen
    }
}

// MARK: - League team (used in league tab views)

nonisolated struct LeagueTeam: Identifiable, Decodable, Sendable {
    let id: String
    let name: String
    let color: String
    let logoUrl: String?
    let crewId: String?
    let divisionId: String?

    nonisolated enum CodingKeys: String, CodingKey {
        case id, name, color
        case logoUrl   = "logo_url"
        case crewId    = "crew_id"
        case divisionId = "division_id"
    }

    var teamColor: Color {
        Color(hex: color) ?? NETRTheme.neonGreen
    }
}

// MARK: - League game (used in the Schedule tab)

nonisolated struct LeagueScheduledGame: Identifiable, Decodable, Sendable {
    let id: String
    let scheduledAt: String
    let location: String?
    let status: String
    let homeScore: Int?
    let awayScore: Int?
    let gameType: String?
    let homeTeamId: String
    let awayTeamId: String

    nonisolated enum CodingKeys: String, CodingKey {
        case id
        case scheduledAt  = "scheduled_at"
        case location, status
        case homeScore    = "home_score"
        case awayScore    = "away_score"
        case gameType     = "game_type"
        case homeTeamId   = "home_team_id"
        case awayTeamId   = "away_team_id"
    }

    var scheduledDate: Date? {
        ISO8601DateFormatter().date(from: scheduledAt)
    }

    var isCompleted: Bool { status == "final" }
    var isCancelled: Bool { status == "cancelled" }
}

// MARK: - Color hex init (shared helper)
// Add this extension if it doesn't already exist in your codebase.

extension Color {
    init?(hex: String) {
        var h = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if h.hasPrefix("#") { h.removeFirst() }
        guard h.count == 6, let value = UInt64(h, radix: 16) else { return nil }
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >>  8) & 0xFF) / 255
        let b = Double( value        & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
