// DESTINATION: ios/NETR/Views/League/LeagueAccountView.swift
//
// The "Account" tab for the league app account.
// Shows the league's public-facing profile info and a sign-out button.

import SwiftUI

struct LeagueAccountView: View {
    let vm: LeagueViewModel
    @Environment(SupabaseManager.self) private var supabase
    @State private var showSignOutConfirm = false

    var body: some View {
        NavigationStack {
            ZStack {
                NETRTheme.background.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 20) {
                        profileHeader
                        statsStrip
                        infoCard
                        signOutButton
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 20)
                }
            }
            .navigationTitle("League Account")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Sub-views

    private var profileHeader: some View {
        VStack(spacing: 14) {
            if let logo = vm.league?.logoUrl {
                AsyncImage(url: URL(string: logo)) { img in
                    img.resizable().scaledToFill()
                } placeholder: {
                    Circle().fill(vm.league?.color ?? NETRTheme.neonGreen)
                }
                .frame(width: 88, height: 88)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(RoundedRectangle(cornerRadius: 20)
                    .stroke((vm.league?.color ?? NETRTheme.neonGreen).opacity(0.5), lineWidth: 2))
            } else {
                RoundedRectangle(cornerRadius: 20)
                    .fill(vm.league?.color ?? NETRTheme.neonGreen)
                    .frame(width: 88, height: 88)
                    .overlay(
                        Text(String(vm.league?.name.prefix(1) ?? "L"))
                            .font(.system(.largeTitle, weight: .black))
                            .foregroundStyle(.black)
                    )
            }

            VStack(spacing: 4) {
                Text(vm.league?.name ?? "")
                    .font(.system(.title2, weight: .black).width(.compressed))
                    .foregroundStyle(NETRTheme.text)
                    .multilineTextAlignment(.center)

                if let season = vm.league?.season {
                    Text(season.uppercased())
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(NETRTheme.muted)
                        .tracking(2)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(NETRTheme.card, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(NETRTheme.border, lineWidth: 1))
    }

    private var statsStrip: some View {
        HStack(spacing: 0) {
            statCell(label: "Teams",  value: "\(vm.teams.count)")
            Divider().frame(height: 36).background(NETRTheme.border)
            statCell(label: "Games",  value: "\(vm.games.count)")
            Divider().frame(height: 36).background(NETRTheme.border)
            statCell(label: "Crews Active",
                     value: "\(vm.teams.filter { $0.crewId != nil }.count)")
        }
        .padding(.vertical, 14)
        .background(NETRTheme.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NETRTheme.border, lineWidth: 1))
    }

    private func statCell(label: String, value: String) -> some View {
        VStack(spacing: 3) {
            Text(value)
                .font(.system(.title3, weight: .black).width(.compressed))
                .foregroundStyle(vm.league?.color ?? NETRTheme.neonGreen)
            Text(label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(NETRTheme.muted)
        }
        .frame(maxWidth: .infinity)
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("LEAGUE INFO")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(NETRTheme.muted)
                .tracking(2)

            if let sport = vm.league?.sport {
                InfoRow(icon: "basketball", label: sport.capitalized)
            }
            if let location = vm.league?.location {
                InfoRow(icon: "map-pin", label: location)
            }
            if let desc = vm.league?.description {
                Text(desc)
                    .font(.subheadline)
                    .foregroundStyle(NETRTheme.subtext)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(NETRTheme.card, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(NETRTheme.border, lineWidth: 1))
    }

    private var signOutButton: some View {
        Button {
            showSignOutConfirm = true
        } label: {
            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                .font(.system(.subheadline, weight: .semibold))
                .foregroundStyle(.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(.red.opacity(0.25), lineWidth: 1))
        }
        .confirmationDialog("Sign out of the league account?",
                            isPresented: $showSignOutConfirm,
                            titleVisibility: .visible) {
            Button("Sign Out", role: .destructive) {
                Task { try? await supabase.signOut() }
            }
            Button("Cancel", role: .cancel) { }
        }
    }
}

private struct InfoRow: View {
    let icon: String
    let label: String

    var body: some View {
        HStack(spacing: 8) {
            LucideIcon(icon, size: 14).foregroundStyle(NETRTheme.subtext)
            Text(label).font(.subheadline).foregroundStyle(NETRTheme.subtext)
        }
    }
}
