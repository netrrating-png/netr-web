// DESTINATION: ios/NETR/Views/League/LeagueTabView.swift
//
// Root view for league accounts. Replaces ContentView when
// supabase.currentProfile?.isLeagueAccount == true.
//
// Tabs: Schedule · Teams · Standings · Stats · Account

import SwiftUI

struct LeagueTabView: View {
    @Environment(SupabaseManager.self) private var supabase
    @State private var selectedTab: Int = 0
    @State private var leagueVM = LeagueViewModel()

    var body: some View {
        TabView(selection: $selectedTab) {
            LeagueScheduleView(vm: leagueVM)
                .tabItem {
                    Label("Schedule", systemImage: "calendar")
                }
                .tag(0)

            LeagueTeamsView(vm: leagueVM)
                .tabItem {
                    Label("Teams", systemImage: "person.3.fill")
                }
                .tag(1)

            LeagueStandingsView(vm: leagueVM)
                .tabItem {
                    Label("Standings", systemImage: "trophy.fill")
                }
                .tag(2)

            LeagueStatsView(vm: leagueVM)
                .tabItem {
                    Label("Stats", systemImage: "chart.bar.fill")
                }
                .tag(3)

            LeagueAccountView(vm: leagueVM)
                .tabItem {
                    Label("Account", systemImage: "building.2.fill")
                }
                .tag(4)
        }
        .tint(leagueVM.league?.color ?? NETRTheme.neonGreen)
        .preferredColorScheme(.dark)
        .task {
            guard let leagueId = supabase.currentProfile?.leagueId else { return }
            await leagueVM.load(profileLeagueId: leagueId)
        }
    }
}
