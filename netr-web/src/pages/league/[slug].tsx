import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getFontFamily, getFontGF } from '../../lib/league-fonts'
import { Globe, MapPin, Mail, X } from 'lucide-react'

type League = { id:string;name:string;slug:string;sport:string;season:string|null;location:string|null;description:string|null;logo_url:string|null;banner_url:string|null;accent_color:string|null;is_active:boolean;announcement:string|null;contact_info:string|null;social_links:Record<string,string>|null;league_font:string|null;signup_url:string|null;signup_label:string|null;rules_sections:{title:string;content:string}[]|null }
type LeagueSeason = { id:string;league_id:string;name:string;start_date:string|null;end_date:string|null;champion_team_id:string|null;notes:string|null;display_order:number;created_at:string }
type Sponsor = { id:string;name:string;logo_url:string|null;website_url:string|null }
type GalleryPhoto = { id:string;photo_url:string;caption:string|null }
type Team = { id:string;name:string;color:string;logo_url:string|null }
type Player = { id:string;display_name:string;jersey_number:string|null;position:string|null;team_id:string }
type Standing = { team_id:string;team_name:string;color:string;wins:number;losses:number;pts_for:number;pts_against:number }
type Game = { id:string;home_team_id:string;away_team_id:string;scheduled_at:string;location:string|null;status:string;home_score:number|null;away_score:number|null;game_type:string|null }
type RawStat = { game_id:string;player_id:string;team_id:string;points:number;rebounds:number;assists:number;steals:number;blocks:number;turnovers:number;field_goals_made:number;field_goals_attempted:number;three_pointers_made:number;three_pointers_attempted:number;free_throws_made:number;free_throws_attempted:number }
type PStat = { player_id:string;display_name:string;team_id:string;team_name:string;team_color:string;gp:number;ppg:number;rpg:number;apg:number;spg:number;bpg:number }
type Tab = 'overview'|'schedule'|'stats'|'teams'|'gallery'|'rules'|'history'
type SortKey = 'ppg'|'rpg'|'apg'|'spg'|'bpg'
const ACC = '#39FF14'

export default function PublicLeaguePage() {
  const router = useRouter()
  const { slug, tab: tabParam } = router.query as { slug:string;tab?:string }
  const [league,setLeague] = useState<League|null>(null)
  const [standings,setStandings] = useState<Standing[]>([])
  const [teams,setTeams] = useState<Team[]>([])
  const [players,setPlayers] = useState<Player[]>([])
  const [allGames,setAllGames] = useState<Game[]>([])
  const [allStats,setAllStats] = useState<RawStat[]>([])
  const [loading,setLoading] = useState(true)
  const [notFound,setNotFound] = useState(false)
  const [dismissed,setDismissed] = useState(false)
  const [boxGameId,setBoxGameId] = useState<string|null>(null)
  const [teamModalId,setTeamModalId] = useState<string|null>(null)
  const [sortBy,setSortBy] = useState<SortKey>('ppg')
  const [myPlayerId,setMyPlayerId] = useState<string|null>(null)
  const [attendanceCounts,setAttendanceCounts] = useState<Record<string,number>>({})
  const [myAttendance,setMyAttendance] = useState<Record<string,'yes'|'no'|'maybe'>>({})
  const [sponsors,setSponsors] = useState<Sponsor[]>([])
  const [galleryPhotos,setGalleryPhotos] = useState<GalleryPhoto[]>([])
  const [lightboxIdx,setLightboxIdx] = useState<number|null>(null)
  const VALID_TABS = ['overview','schedule','stats','teams','gallery','rules','history']
  const activeTab:Tab = (VALID_TABS.includes(tabParam as string)?tabParam:'overview') as Tab
  const setTab = (t:Tab) => router.replace({pathname:router.pathname,query:{slug,tab:t}},undefined,{shallow:true})

  const [seasons,setSeasons] = useState<LeagueSeason[]>([])
  const [selectedSeasonId,setSelectedSeasonId] = useState<string|null>(null)
  const [seasonGames,setSeasonGames] = useState<Game[]>([])
  const [seasonStats,setSeasonStats] = useState<RawStat[]>([])
  const [loadingSeason,setLoadingSeason] = useState(false)

  useEffect(()=>{ if(slug) load() },[slug])

  async function rsvp(gameId:string, status:'yes'|'no'|'maybe') {
    if(!myPlayerId) return
    setMyAttendance(prev=>({...prev,[gameId]:status}))
    setAttendanceCounts(prev=>{
      const prev_status=myAttendance[gameId]
      const next={...prev}
      if(prev_status==='yes') next[gameId]=(next[gameId]||1)-1
      if(status==='yes') next[gameId]=(next[gameId]||0)+1
      return next
    })
    await supabase.from('league_game_attendance').upsert({game_id:gameId,player_id:myPlayerId,status},{onConflict:'game_id,player_id'})
  }

  async function load() {
    const {data:lg} = await supabase.from('leagues').select('*').eq('slug',slug).single()
    if(!lg){setNotFound(true);setLoading(false);return}
    setLeague(lg)
    const [sr,tr,gr,pr] = await Promise.all([
      supabase.from('league_standings').select('*').eq('league_id',lg.id).order('wins',{ascending:false}),
      supabase.from('league_teams').select('id,name,color,logo_url').eq('league_id',lg.id),
      supabase.from('league_games').select('*').eq('league_id',lg.id).order('scheduled_at',{ascending:true}),
      supabase.from('league_players').select('id,display_name,jersey_number,position,team_id').eq('league_id',lg.id),
    ])
    setStandings(sr.data??[]);setTeams(tr.data??[]);setAllGames(gr.data??[]);setPlayers(pr.data??[])
    const [sponsorsRes,galleryRes,seasonsRes] = await Promise.all([
      supabase.from('league_sponsors').select('id,name,logo_url,website_url').eq('league_id',lg.id).order('display_order'),
      supabase.from('league_gallery_photos').select('id,photo_url,caption').eq('league_id',lg.id).order('created_at',{ascending:false}),
      supabase.from('league_seasons').select('*').eq('league_id',lg.id).order('display_order',{ascending:false}),
    ])
    setSponsors(sponsorsRes.data??[]);setGalleryPhotos(galleryRes.data??[]);setSeasons(seasonsRes.data??[])
    const pids=(pr.data??[]).map((p:Player)=>p.id)
    if(pids.length>0){
      const {data:sd}=await supabase.from('league_player_stats').select('game_id,player_id,team_id,points,rebounds,assists,steals,blocks,turnovers,field_goals_made,field_goals_attempted,three_pointers_made,three_pointers_attempted,free_throws_made,free_throws_attempted').in('player_id',pids)
      setAllStats(sd??[])
    }
    // load attendance counts + check if viewer is a claimed player
    const upcomingIds=(gr.data??[]).filter((g:Game)=>g.status==='scheduled').map((g:Game)=>g.id)
    if(upcomingIds.length>0){
      const {data:att}=await supabase.from('league_game_attendance').select('game_id,player_id,status').in('game_id',upcomingIds)
      const counts:Record<string,number>={}
      for(const a of (att??[])) if(a.status==='yes') counts[a.game_id]=(counts[a.game_id]||0)+1
      setAttendanceCounts(counts)
      const {data:{user}}=await supabase.auth.getUser()
      if(user){
        const {data:myPlayer}=await supabase.from('league_players').select('id').eq('league_id',lg.id).eq('profile_id',user.id).single()
        if(myPlayer){
          setMyPlayerId(myPlayer.id)
          const myAtt:Record<string,'yes'|'no'|'maybe'>={}
          for(const a of (att??[])) if(a.player_id===myPlayer.id) myAtt[a.game_id]=a.status
          setMyAttendance(myAtt)
        }
      }
    }
    setLoading(false)
  }

  async function loadSeason(seasonId:string) {
    setLoadingSeason(true)
    setSelectedSeasonId(seasonId)
    const {data:sg} = await supabase.from('league_games').select('*').eq('season_id',seasonId).order('scheduled_at')
    const sgData = sg ?? []
    setSeasonGames(sgData)
    const gameIds = sgData.map((g:Game)=>g.id)
    if(gameIds.length>0){
      const {data:ss} = await supabase.from('league_player_stats').select('game_id,player_id,team_id,points,rebounds,assists,steals,blocks,turnovers,field_goals_made,field_goals_attempted,three_pointers_made,three_pointers_attempted,free_throws_made,free_throws_attempted').in('game_id',gameIds)
      setSeasonStats(ss??[])
    } else {
      setSeasonStats([])
    }
    setLoadingSeason(false)
  }

  function computeSeasonStandings(games:Game[]):Standing[] {
    const map:Record<string,Standing>={}
    for(const t of teams) map[t.id]={team_id:t.id,team_name:t.name,color:t.color,wins:0,losses:0,pts_for:0,pts_against:0}
    for(const g of games){
      if(g.status!=='final'||g.home_score==null||g.away_score==null) continue
      const h=map[g.home_team_id],a=map[g.away_team_id]
      if(!h||!a) continue
      h.pts_for+=g.home_score;h.pts_against+=g.away_score
      a.pts_for+=g.away_score;a.pts_against+=g.home_score
      if(g.home_score>g.away_score){h.wins++;a.losses++} else {a.wins++;h.losses++}
    }
    return Object.values(map).filter(s=>s.wins+s.losses>0).sort((a,b)=>b.wins-a.wins||(b.pts_for-b.pts_against)-(a.pts_for-a.pts_against))
  }

  if(loading) return <Spinner/>
  if(notFound||!league) return <NotFound/>
  const accent=league.accent_color||ACC
  const displayFont=getFontFamily(league.league_font)
  const fontGF=getFontGF(league.league_font)
  const tMap=Object.fromEntries(teams.map(t=>[t.id,t]))
  const pMap=Object.fromEntries(players.map(p=>[p.id,p]))
  const sMap=Object.fromEntries(standings.map(s=>[s.team_id,s]))
  const finals=[...allGames].filter(g=>g.status==='final').sort((a,b)=>b.scheduled_at.localeCompare(a.scheduled_at))
  const upcoming=allGames.filter(g=>g.status==='scheduled')
  const pStats=computeStats(allStats,pMap,tMap)
  const boxGame=boxGameId?allGames.find(g=>g.id===boxGameId)??null:null
  const boxStats=boxGameId?allStats.filter(s=>s.game_id===boxGameId):[]
  const modalTeam=teamModalId?teams.find(t=>t.id===teamModalId)??null:null
  const modalPlayers=teamModalId?players.filter(p=>p.team_id===teamModalId):[]
  const modalPStats=teamModalId?pStats.filter(s=>s.team_id===teamModalId):[]
  const myTeamId=myPlayerId?players.find(p=>p.id===myPlayerId)?.team_id??null:null

  return(<>
    <Head>
      <title>{league.name}</title>
      <meta name="robots" content="noindex"/>
      <meta name="viewport" content="width=device-width,initial-scale=1"/>
      <link href={`https://fonts.googleapis.com/css2?family=${fontGF}&family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap`} rel="stylesheet"/>
      <style>{`
        @keyframes logoPulse {
          0%,100% { box-shadow: 0 0 0 0 ${accent}40, 0 0 32px ${accent}30; }
          50%      { box-shadow: 0 0 0 8px ${accent}00, 0 0 48px ${accent}50; }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(16px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .hero-logo { animation: logoPulse 3s ease-in-out infinite; }
        .hero-content > * { animation: fadeUp 0.5s ease both; }
        .hero-content > *:nth-child(1) { animation-delay: 0.05s; }
        .hero-content > *:nth-child(2) { animation-delay: 0.12s; }
        .hero-content > *:nth-child(3) { animation-delay: 0.2s; }
        .hero-content > *:nth-child(4) { animation-delay: 0.28s; }
      `}</style>
    </Head>
    <div style={{minHeight:'100vh',background:'#040406',fontFamily:"'DM Sans',sans-serif",color:'#EEEEF5'}}>

      {/* ── HERO ── */}
      <div style={{position:'relative',minHeight:600,background:'#040406',overflow:'hidden',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
        {/* Banner */}
        {league.banner_url
          ?<img src={league.banner_url} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top',display:'block'}}/>
          :<>
            {/* No-banner: rich layered background */}
            <div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,#060610 0%,#040406 50%,#06060C 100%)`}}/>
            <div style={{position:'absolute',inset:0,backgroundImage:`radial-gradient(circle,${accent}18 1px,transparent 1px)`,backgroundSize:'32px 32px',opacity:0.35}}/>
          </>
        }
        {/* Gradient scrims */}
        <div style={{position:'absolute',inset:0,background:league.banner_url
          ?`linear-gradient(to bottom, rgba(4,4,6,0.15) 0%, rgba(4,4,6,0.55) 35%, rgba(4,4,6,0.95) 75%, #040406 100%)`
          :`linear-gradient(to bottom, transparent 0%, rgba(4,4,6,0.6) 60%, #040406 100%)`}}/>
        {/* Color glows */}
        <div style={{position:'absolute',bottom:0,left:0,width:'60%',height:'70%',background:`radial-gradient(ellipse at 0% 100%, ${accent}20 0%, transparent 65%)`,pointerEvents:'none'}}/>
        <div style={{position:'absolute',top:0,right:0,width:'40%',height:'50%',background:`radial-gradient(ellipse at 100% 0%, ${accent}08 0%, transparent 60%)`,pointerEvents:'none'}}/>

        {/* Hero content */}
        <div className="hero-content" style={{position:'relative',zIndex:1,maxWidth:980,margin:'0 auto',width:'100%',padding:'90px 24px 52px',display:'flex',flexDirection:'column',gap:0}}>

          {/* Badge row: active pill + season pill */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap' as const}}>
            <span style={{display:'inline-flex',alignItems:'center',gap:7,background:`${accent}14`,border:`1px solid ${accent}35`,borderRadius:99,padding:'4px 12px 4px 9px'}}>
              <span style={{width:6,height:6,borderRadius:'50%',background:accent,display:'inline-block',boxShadow:`0 0 8px ${accent}`,flexShrink:0}}/>
              <span style={{fontSize:9,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:3,textTransform:'uppercase' as const}}>{league.is_active?'Active Season':league.sport||'League'}</span>
            </span>
            {league.season&&(
              <span style={{display:'inline-flex',alignItems:'center',background:'rgba(0,0,0,0.55)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:99,padding:'4px 12px',fontSize:10,color:'rgba(238,238,245,0.9)',fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:'uppercase' as const,fontWeight:600}}>
                {league.season}
              </span>
            )}
          </div>

          {/* Logo + Name */}
          <div style={{display:'flex',alignItems:'center',gap:20,marginBottom:20,flexWrap:'wrap' as const}}>
            {league.logo_url&&(
              <div style={{position:'relative',flexShrink:0}}>
                <div style={{position:'absolute',inset:-8,borderRadius:22,background:`radial-gradient(circle, ${accent}35 0%, transparent 70%)`,filter:'blur(10px)'}}/>
                <div style={{position:'absolute',inset:-2,borderRadius:18,border:`1.5px solid ${accent}50`}}/>
                <img
                  src={league.logo_url}
                  alt={league.name}
                  className="hero-logo"
                  style={{position:'relative',width:88,height:88,borderRadius:16,objectFit:'cover',background:'#0A0A0E',display:'block'}}
                />
              </div>
            )}
            <h1 style={{
              flex:1,minWidth:0,
              fontFamily:displayFont,fontWeight:900,
              fontSize:'clamp(38px,7vw,84px)',
              textTransform:'uppercase' as const,
              lineHeight:0.92,letterSpacing:'-1.5px',
              margin:0,wordBreak:'break-word' as const,
              textShadow:`0 2px 40px ${accent}30`,
            }}>{league.name}</h1>
          </div>

          {/* Description — center stage */}
          {league.description&&(
            <div style={{borderLeft:`3px solid ${accent}`,paddingLeft:20,marginBottom:22}}>
              <p style={{
                fontFamily:"'DM Sans',sans-serif",
                fontSize:'clamp(16px,2.2vw,21px)',
                color:'rgba(238,238,245,0.92)',
                lineHeight:1.6,
                margin:0,
                fontWeight:400,
                letterSpacing:'-0.1px',
              }}>
                {league.description}
              </p>
            </div>
          )}

          {/* Social icons — their own row, grouped */}
          {league.social_links&&Object.values(league.social_links).some(Boolean)&&(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16}}>
              <SocialIcons links={league.social_links} accent={accent}/>
            </div>
          )}

          {/* Meta + CTA */}
          <div style={{display:'flex',alignItems:'center',flexWrap:'wrap' as const,gap:8}}>
            {league.location&&(
              <span style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:99,padding:'6px 14px',fontSize:12,color:'#9090A8',fontFamily:"'DM Sans',sans-serif"}}>
                <MapPin size={12} strokeWidth={2}/>{league.location}
              </span>
            )}
            {league.contact_info&&(
              <a href={league.contact_info.includes('@')?`mailto:${league.contact_info}`:league.contact_info.startsWith('http')?league.contact_info:`tel:${league.contact_info}`}
                style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:99,padding:'6px 14px',fontSize:12,color:'#9090A8',fontFamily:"'DM Sans',sans-serif",textDecoration:'none',whiteSpace:'nowrap' as const}}>
                <Mail size={12} strokeWidth={2}/>Contact
              </a>
            )}
            {league.signup_url&&(
              <a href={league.signup_url} target="_blank" rel="noopener noreferrer"
                style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:8,background:accent,color:'#040406',fontFamily:displayFont,fontWeight:900,fontSize:15,textTransform:'uppercase' as const,letterSpacing:'1px',padding:'11px 28px',borderRadius:12,textDecoration:'none',flexShrink:0,boxShadow:`0 4px 28px ${accent}50,0 0 0 1px ${accent}`,whiteSpace:'nowrap' as const}}>
                {league.signup_label||'Join the League'} →
              </a>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{position:'relative',zIndex:1,borderTop:`1px solid ${accent}20`,background:'rgba(4,4,6,0.75)',backdropFilter:'blur(12px)'}}>
          <div style={{maxWidth:980,margin:'0 auto',display:'flex',padding:'0 24px',overflowX:'auto',scrollbarWidth:'none' as const}}>
            {[
              {label:'Teams',value:teams.length},
              {label:'Games Played',value:allGames.filter(g=>g.status==='final').length},
              {label:'Players',value:players.length},
              ...(standings[0]&&standings[0].wins>0?[{label:'League Leader',value:standings[0].team_name,accent:true}]:[]),
            ].map((item,i)=>(
              <div key={i} style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'14px 28px',borderRight:`1px solid rgba(255,255,255,0.05)`,flexShrink:0}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:item.accent?15:24,color:item.accent?accent:'#EEEEF5',textTransform:'uppercase' as const,letterSpacing:item.accent?0.5:-0.5,lineHeight:1}}>{item.value}</div>
                <div style={{fontSize:9,color:'#3A3A4E',fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:'uppercase' as const,marginTop:3}}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{height:2,background:`linear-gradient(90deg,${accent},${accent}60,transparent 70%)`}}/>
      </div>

      {/* Announcement */}
      {league.announcement&&!dismissed&&(
        <div style={{background:`linear-gradient(90deg,${accent}18,${accent}10)`,borderBottom:`1px solid ${accent}30`,padding:'0 24px'}}>
          <div style={{maxWidth:980,margin:'0 auto',display:'flex',alignItems:'center',gap:14,padding:'13px 0'}}>
            <div style={{width:28,height:28,borderRadius:8,background:`${accent}20`,border:`1px solid ${accent}40`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>📢</div>
            <span style={{flex:1,fontSize:13,lineHeight:1.6,color:'rgba(238,238,245,0.85)'}}>{league.announcement}</span>
            <button onClick={()=>setDismissed(true)} style={{background:'none',border:'1px solid rgba(255,255,255,0.08)',borderRadius:6,color:'#C8C8D4',cursor:'pointer',width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:14}}>
              <X size={14} strokeWidth={2}/>
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{background:'rgba(4,4,6,0.92)',borderBottom:'1px solid #1A1A28',position:'sticky',top:0,zIndex:50,backdropFilter:'blur(16px)'}}>
        <div style={{maxWidth:960,margin:'0 auto',display:'flex',overflowX:'auto',padding:'0 8px',scrollbarWidth:'none' as const}}>
          {([
            ['overview','Overview'],['schedule','Schedule'],['stats','Stats'],['teams','Teams'],
            ...(league.rules_sections&&league.rules_sections.length>0?[['rules','Rules']]:[] as [Tab,string][]),
            ...(seasons.length>0?[['history','History']]:[] as [Tab,string][]),
            ...(galleryPhotos.length>0?[['gallery','Gallery']]:[] as [Tab,string][]),
          ] as [Tab,string][]).map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',borderBottom:activeTab===t?`3px solid ${accent}`:'3px solid transparent',color:activeTab===t?accent:'#C8C8D4',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,textTransform:'uppercase',letterSpacing:1.5,padding:'16px 18px',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,transition:'color 0.15s'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main style={{maxWidth:960,margin:'0 auto',padding:'32px 16px 80px'}}>

        {/* OVERVIEW */}
        {activeTab==='overview'&&<>

          {/* Stat leader cards */}
          {pStats.length>0&&(()=>{
            const leaders=[
              {key:'ppg' as const,label:'Points',unit:'PPG',icon:'🏀'},
              {key:'rpg' as const,label:'Rebounds',unit:'RPG',icon:'💪'},
              {key:'apg' as const,label:'Assists',unit:'APG',icon:'🎯'},
            ]
            return(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:36}}>
                {leaders.map(({key,label,unit,icon})=>{
                  const leader=[...pStats].sort((a,b)=>b[key]-a[key])[0]
                  if(!leader) return null
                  const team=tMap[leader.team_id]
                  return(
                    <div key={key} style={{position:'relative',overflow:'hidden',background:'#0D0D12',border:`1px solid ${team?.color??accent}33`,borderRadius:16,padding:'20px 22px'}}>
                      <div style={{position:'absolute',top:0,right:0,width:80,height:80,borderRadius:'0 16px 0 80px',background:`${team?.color??accent}12`}}/>
                      <div style={{fontSize:10,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:'uppercase' as const,marginBottom:10}}>{icon} {label} Leader</div>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:48,lineHeight:1,color:team?.color??accent,marginBottom:4}}>{leader[key]}</div>
                      <div style={{fontSize:9,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",letterSpacing:2,marginBottom:10}}>{unit}</div>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:'uppercase' as const,color:'#EEEEF5'}}>{leader.display_name}</div>
                      <div style={{fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",marginTop:2,display:'flex',alignItems:'center',gap:4}}>
                        {team&&<span style={{width:6,height:6,borderRadius:'50%',background:team.color,display:'inline-block'}}/>}
                        {leader.team_name}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Two-column: upcoming + standings mini */}
          <div style={{display:'grid',gridTemplateColumns:standings.length>0?'1fr 320px':'1fr',gap:24,alignItems:'start',marginBottom:48}}>
            {/* Upcoming games */}
            <section>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap' as const,gap:8}}>
                <SectionLabel accent={accent} noMargin>Next Up</SectionLabel>
                {myTeamId&&<CalendarButtons slug={league.slug} teamId={myTeamId} size="sm"/>}
              </div>
              {upcoming.length===0?<Empty>No games scheduled yet.</Empty>:(
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {upcoming.slice(0,4).map(g=>(
                    <div key={g.id}>
                      <GCard g={g} tMap={tMap} accent={accent} rsvpCount={attendanceCounts[g.id]||0}/>
                      {myPlayerId&&<RsvpRow gameId={g.id} myStatus={myAttendance[g.id]||null} accent={accent} onRsvp={rsvp}/>}
                    </div>
                  ))}
                  {upcoming.length>4&&(
                    <button onClick={()=>setTab('schedule')} style={{background:`${accent}10`,border:`1px solid ${accent}30`,borderRadius:12,padding:'13px',color:accent,fontSize:12,fontFamily:"'DM Mono',monospace",cursor:'pointer',textAlign:'center' as const,letterSpacing:1.5,textTransform:'uppercase' as const}}>
                      Full Schedule — {upcoming.length} games →
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* Mini standings */}
            {standings.length>0&&(
              <section>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                  <SectionLabel accent={accent} noMargin>Standings</SectionLabel>
                  <button onClick={()=>setTab('schedule')} style={{background:'none',border:'none',color:'#C8C8D4',fontSize:11,fontFamily:"'DM Mono',monospace",cursor:'pointer',letterSpacing:1}}>Full →</button>
                </div>
                <div style={{background:'#0D0D12',border:'1px solid #1A1A28',borderRadius:14,overflow:'hidden'}}>
                  {standings.slice(0,6).map((s,i)=>{
                    const gp=s.wins+s.losses,pct=gp>0?s.wins/gp:0,top=i===0&&s.wins>0
                    return(
                      <button key={s.team_id} onClick={()=>setTeamModalId(s.team_id)} style={{width:'100%',background:'none',border:'none',borderBottom:'1px solid #12121C',padding:'10px 14px',cursor:'pointer',textAlign:'left' as const,display:'flex',alignItems:'center',gap:10}}
                        onMouseEnter={e=>e.currentTarget.style.background='#12121C'}
                        onMouseLeave={e=>e.currentTarget.style.background='none'}>
                        <span style={{width:18,fontFamily:"'DM Mono',monospace",fontSize:11,color:top?accent:'#3A3A4E',flexShrink:0}}>{top?'🏆':i+1}</span>
                        <div style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,textTransform:'uppercase' as const,color:top?'#EEEEF5':'#C8C8D4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{s.team_name}</div>
                          <div style={{height:3,background:'#1A1A28',borderRadius:2,marginTop:4,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${pct*100}%`,background:top?accent:s.color,borderRadius:2,transition:'width 0.5s'}}/>
                          </div>
                        </div>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:top?accent:'#C8C8D4',flexShrink:0}}>{s.wins}–{s.losses}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Recent results */}
          {finals.length>0&&(
            <section style={{marginBottom:48}}>
              <SectionLabel accent={accent}>Recent Results</SectionLabel>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {finals.slice(0,3).map(g=><GCard key={g.id} g={g} tMap={tMap} accent={accent} onClick={()=>setBoxGameId(g.id)}/>)}
              </div>
            </section>
          )}

          {/* Gallery strip */}
          {galleryPhotos.length>0&&(
            <section style={{marginBottom:48}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap' as const,gap:8}}>
                <SectionLabel accent={accent} noMargin>Gallery</SectionLabel>
                <button onClick={()=>setTab('gallery')} style={{background:'none',border:'none',color:accent,fontSize:11,fontFamily:"'DM Mono',monospace",cursor:'pointer',letterSpacing:1,textTransform:'uppercase' as const,padding:0}}>All {galleryPhotos.length} →</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
                {galleryPhotos.slice(0,6).map((p,i)=>(
                  <div key={p.id} onClick={()=>{setTab('gallery');setTimeout(()=>setLightboxIdx(i),50)}}
                    style={{aspectRatio:'4/3',borderRadius:10,overflow:'hidden',cursor:'pointer',border:'1px solid #1C1C26'}}>
                    <img src={p.photo_url} alt={p.caption??''} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform 0.3s'}}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.06)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sponsors */}
          {sponsors.length>0&&(
            <section style={{marginBottom:48}}>
              <SectionLabel accent={accent}>Our Sponsors</SectionLabel>
              <div style={{display:'flex',flexWrap:'wrap' as const,gap:10,alignItems:'center'}}>
                {sponsors.map(sp=>(
                  <a key={sp.id} href={sp.website_url??undefined} target="_blank" rel="noopener noreferrer"
                    style={{display:'flex',alignItems:'center',gap:10,background:'#0D0D12',border:'1px solid #1A1A28',borderRadius:12,padding:'12px 18px',textDecoration:'none',transition:'border-color 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=accent+'55'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#1A1A28'}>
                    {sp.logo_url&&<img src={sp.logo_url} alt={sp.name} style={{height:28,maxWidth:72,objectFit:'contain',borderRadius:4,background:'#fff',padding:'2px 6px'}}/>}
                    <span style={{fontFamily:displayFont,fontWeight:700,fontSize:15,textTransform:'uppercase' as const,color:'#EEEEF5'}}>{sp.name}</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </>}

        {/* SCHEDULE */}
        {activeTab==='schedule'&&<>
          {standings.length>0&&(
            <section style={{marginBottom:40}}>
              <SecTitle accent={accent}>Standings</SecTitle>
              <div style={{background:'#0D0D12',border:'1px solid #1A1A28',borderRadius:16,overflow:'hidden'}}>
                {standings.map((s,i)=>{
                  const gp=s.wins+s.losses,pct=gp>0?(s.wins/gp).toFixed(3).replace(/^0/,''):'.000',diff=s.pts_for-s.pts_against,top=i===0&&s.wins>0,winPct=gp>0?s.wins/gp:0
                  return(
                    <div key={s.team_id} onClick={()=>setTeamModalId(s.team_id)} style={{display:'grid',gridTemplateColumns:'40px 1fr auto',alignItems:'center',borderBottom:'1px solid #0F0F18',padding:'14px 18px',cursor:'pointer',background:top?`${accent}06`:'transparent',gap:12,transition:'background 0.1s'}}
                      onMouseEnter={e=>e.currentTarget.style.background=top?`${accent}10`:'#0F0F18'}
                      onMouseLeave={e=>e.currentTarget.style.background=top?`${accent}06`:'transparent'}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:top?accent:'#2E2E3A',textAlign:'center' as const}}>{top?'🏆':i+1}</div>
                      <div style={{minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                          {s.color&&<div style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0,boxShadow:`0 0 6px ${s.color}88`}}/>}
                          <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:'uppercase' as const,color:top?'#EEEEF5':'#C8C8D4',letterSpacing:0.5}}>{s.team_name}</span>
                        </div>
                        <div style={{height:4,background:'#151520',borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${winPct*100}%`,background:top?`linear-gradient(90deg,${accent},${accent}88)`:`linear-gradient(90deg,${s.color},${s.color}66)`,borderRadius:2}}/>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:20,alignItems:'center',flexShrink:0}}>
                        <div style={{textAlign:'center' as const}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:top?accent:'#EEEEF5',lineHeight:1}}>{s.wins}</div>
                          <div style={{fontSize:9,color:'#3A3A4E',fontFamily:"'DM Mono',monospace",letterSpacing:1}}>W</div>
                        </div>
                        <div style={{textAlign:'center' as const}}>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:24,color:'#3A3A4E',lineHeight:1}}>{s.losses}</div>
                          <div style={{fontSize:9,color:'#3A3A4E',fontFamily:"'DM Mono',monospace",letterSpacing:1}}>L</div>
                        </div>
                        <div style={{textAlign:'center' as const,minWidth:36}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:'#C8C8D4',lineHeight:1}}>{pct}</div>
                          <div style={{fontSize:9,color:'#3A3A4E',fontFamily:"'DM Mono',monospace",letterSpacing:1}}>PCT</div>
                        </div>
                        <div style={{textAlign:'center' as const,minWidth:36}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:diff>0?accent:diff<0?'#FF453A':'#C8C8D4',lineHeight:1}}>{diff>0?'+':''}{diff}</div>
                          <div style={{fontSize:9,color:'#3A3A4E',fontFamily:"'DM Mono',monospace",letterSpacing:1}}>DIFF</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          <div style={{background:'#0A0A0E',border:'1px solid #1C1C26',borderRadius:10,padding:'14px 16px',marginBottom:20}}>
            <div style={{fontSize:12,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",marginBottom:10,textTransform:'uppercase' as const,letterSpacing:1}}>
              {myTeamId?`Subscribe to ${teams.find(t=>t.id===myTeamId)?.name??'Your Team'}'s games`:'Subscribe — auto-updates when schedule changes'}
            </div>
            <CalendarButtons slug={league.slug} teamId={myTeamId??undefined} size="lg"/>
          </div>
          <section>
            <SecTitle accent={accent}>Full Schedule</SecTitle>
            {allGames.length===0?<Empty>No games yet.</Empty>:<div style={{display:'flex',flexDirection:'column',gap:8}}>{allGames.map(g=><GCard key={g.id} g={g} tMap={tMap} accent={accent} showLoc onClick={g.status==='final'?()=>setBoxGameId(g.id):undefined}/>)}</div>}
          </section>
        </>}

        {/* STATS */}
        {activeTab==='stats'&&<section>
          <SecTitle accent={accent}>Player Stats</SecTitle>
          {pStats.length===0?<Empty>No stats yet.</Empty>:(
            <>
              {/* Podium — top 3 in selected category */}
              {(()=>{
                const sorted=[...pStats].sort((a,b)=>b[sortBy]-a[sortBy]).slice(0,3)
                const medals=['🥇','🥈','🥉']
                const sizes=[52,40,36]
                return(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:28}}>
                    {sorted.map((p,i)=>{
                      const team=tMap[p.team_id]
                      return(
                        <div key={p.player_id} onClick={()=>setTeamModalId(p.team_id)} style={{position:'relative',overflow:'hidden',background:'#0D0D12',border:`1px solid ${i===0?accent+'44':'#1A1A28'}`,borderRadius:16,padding:'20px',cursor:'pointer',transition:'transform 0.15s'}}
                          onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                          onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                          <div style={{position:'absolute',top:0,right:0,fontSize:48,opacity:0.06,lineHeight:1,userSelect:'none' as const}}>{medals[i]}</div>
                          <div style={{fontSize:20,marginBottom:8}}>{medals[i]}</div>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:sizes[i],color:i===0?accent:'#EEEEF5',lineHeight:1,marginBottom:4}}>{p[sortBy]}</div>
                          <div style={{fontSize:9,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",letterSpacing:2,marginBottom:10}}>{{ppg:'PTS/G',rpg:'REB/G',apg:'AST/G',spg:'STL/G',bpg:'BLK/G'}[sortBy]}</div>
                          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase' as const,color:'#EEEEF5'}}>{p.display_name}</div>
                          <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3}}>
                            {team&&<span style={{width:6,height:6,borderRadius:'50%',background:team.color,display:'inline-block'}}/>}
                            <span style={{fontSize:10,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>{p.team_name}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
              {/* Sort tabs */}
              <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap' as const}}>
                {(['ppg','rpg','apg','spg','bpg'] as SortKey[]).map(k=>(
                  <button key={k} onClick={()=>setSortBy(k)} style={{background:sortBy===k?`${accent}18`:'#0D0D12',border:`1px solid ${sortBy===k?accent+'55':'#1A1A28'}`,borderRadius:8,color:sortBy===k?accent:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:1.5,padding:'6px 14px',cursor:'pointer',textTransform:'uppercase' as const,transition:'all 0.15s'}}>
                    {{ppg:'Points',rpg:'Rebounds',apg:'Assists',spg:'Steals',bpg:'Blocks'}[k]}
                  </button>
                ))}
              </div>
              {/* Full table */}
              <div style={{background:'#0D0D12',border:'1px solid #1A1A28',borderRadius:14,overflow:'hidden',overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse',minWidth:480}}>
                  <thead><tr style={{background:'#080810',borderBottom:'1px solid #1A1A28'}}>
                    <th style={{...TH,textAlign:'left'}}>Player</th>
                    <th style={TH}>GP</th>
                    {(['ppg','rpg','apg','spg','bpg'] as SortKey[]).map(k=>(
                      <th key={k} style={{...TH,cursor:'pointer',color:sortBy===k?accent:'#C8C8D4'}} onClick={()=>setSortBy(k)}>
                        {{ppg:'PTS',rpg:'REB',apg:'AST',spg:'STL',bpg:'BLK'}[k]}{sortBy===k?' ▾':''}
                      </th>
                    ))}
                  </tr></thead>
                  <tbody>{[...pStats].sort((a,b)=>b[sortBy]-a[sortBy]).map((p,i)=>(
                    <tr key={p.player_id} onClick={()=>setTeamModalId(p.team_id)} style={{borderBottom:'1px solid #0A0A12',cursor:'pointer'}} onMouseEnter={e=>(e.currentTarget.style.background='#0F0F18')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <td style={{...TD,textAlign:'left',paddingLeft:16}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:'#2E2E3A',width:18,flexShrink:0}}>{i+1}</span>
                          <div>
                            <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase' as const}}>{p.display_name}</div>
                            <div style={{fontSize:10,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",display:'flex',alignItems:'center',gap:4,marginTop:1}}><span style={{display:'inline-block',width:5,height:5,borderRadius:'50%',background:p.team_color}}/>{p.team_name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#3A3A4E'}}>{p.gp}</td>
                      {(['ppg','rpg','apg','spg','bpg'] as SortKey[]).map(k=>(
                        <td key={k} style={{...TD,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:sortBy===k?700:400,fontSize:sortBy===k?20:15,color:sortBy===k?(i===0?accent:'#EEEEF5'):'#C8C8D4'}}>{p[k]}</td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </section>}

        {/* TEAMS */}
        {activeTab==='teams'&&<section>
          <SecTitle accent={accent}>Teams</SecTitle>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
            {teams.map(t=>{
              const s=sMap[t.id],cnt=players.filter(p=>p.team_id===t.id).length,top=standings[0]?.team_id===t.id&&standings[0]?.wins>0
              return(
                <button key={t.id} onClick={()=>setTeamModalId(t.id)} style={{position:'relative',overflow:'hidden',background:'#0D0D12',border:`1px solid ${top?t.color+'55':'#1A1A28'}`,borderRadius:16,padding:'20px',cursor:'pointer',textAlign:'left' as const,width:'100%',transition:'transform 0.15s,box-shadow 0.15s'}}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 28px ${t.color}22`}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
                  {/* Color wash */}
                  <div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,${t.color}12 0%,transparent 60%)`,pointerEvents:'none'}}/>
                  <div style={{position:'absolute',top:0,right:0,width:80,height:80,borderRadius:'0 16px 0 80px',background:`${t.color}10`}}/>
                  <div style={{position:'relative',display:'flex',alignItems:'flex-start',gap:14}}>
                    {t.logo_url
                      ?<img src={t.logo_url} alt={t.name} style={{width:52,height:52,borderRadius:10,objectFit:'cover',flexShrink:0,border:`2px solid ${t.color}44`}}/>
                      :<div style={{width:52,height:52,borderRadius:12,background:`linear-gradient(135deg,${t.color},${t.color}88)`,boxShadow:`0 0 20px ${t.color}44`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:'rgba(255,255,255,0.9)',textTransform:'uppercase' as const}}>{t.name.slice(0,2)}</span>
                      </div>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:'uppercase' as const,color:'#EEEEF5',letterSpacing:0.5,lineHeight:1.1,marginBottom:6}}>{t.name}</div>
                      <div style={{display:'flex',gap:12,alignItems:'center'}}>
                        {s&&s.wins+s.losses>0&&(
                          <>
                            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,color:top?accent:'#EEEEF5'}}>{s.wins}–{s.losses}</span>
                            <span style={{fontSize:10,color:top?accent+'88':'#3A3A4E',fontFamily:"'DM Mono',monospace"}}>
                              {s.wins+s.losses>0?((s.wins/(s.wins+s.losses))*100).toFixed(0)+'%WIN':''}
                            </span>
                          </>
                        )}
                        <span style={{fontSize:10,color:'#3A3A4E',fontFamily:"'DM Mono',monospace"}}>{cnt} players</span>
                      </div>
                      {top&&<div style={{marginTop:6,fontSize:9,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:2}}>🏆 LEAGUE LEADER</div>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>}

        {/* GALLERY */}
        {activeTab==='gallery'&&<section>
          <SecTitle accent={accent}>Gallery</SecTitle>
          {galleryPhotos.length===0?<Empty>No photos yet.</Empty>:(
            <div style={{columns:'3 180px',columnGap:12}}>
              {galleryPhotos.map((p,i)=>(
                <div key={p.id} onClick={()=>setLightboxIdx(i)} style={{breakInside:'avoid',marginBottom:12,borderRadius:10,overflow:'hidden',cursor:'pointer',position:'relative'}}>
                  <img src={p.photo_url} alt={p.caption??''} style={{width:'100%',display:'block',borderRadius:10,transition:'transform 0.2s'}}
                    onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.02)')}
                    onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}/>
                  {p.caption&&<div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(0,0,0,0.75))',padding:'24px 12px 10px',fontSize:12,color:'#EEEEF5',fontFamily:"'DM Sans',sans-serif"}}>{p.caption}</div>}
                </div>
              ))}
            </div>
          )}
        </section>}

        {/* RULES */}
        {activeTab==='rules'&&<section>
          <SecTitle accent={accent}>League Rules</SecTitle>
          {(!league.rules_sections||league.rules_sections.length===0)?<Empty>No rules posted yet.</Empty>:(
            <div style={{display:'flex',flexDirection:'column',gap:24}}>
              {league.rules_sections.map((sec,i)=>(
                <div key={i} style={{background:'#0A0A0E',border:'1px solid #1C1C26',borderRadius:12,overflow:'hidden'}}>
                  {sec.title&&(
                    <div style={{padding:'14px 20px',borderBottom:'1px solid #1C1C26',background:'#0F0F14'}}>
                      <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:18,textTransform:'uppercase',letterSpacing:0.5,color:accent}}>{sec.title}</span>
                    </div>
                  )}
                  <div style={{padding:'16px 20px',fontSize:14,lineHeight:1.75,color:'rgba(238,238,245,0.85)',whiteSpace:'pre-wrap' as const,fontFamily:"'DM Sans',sans-serif"}}>
                    {sec.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>}

        {/* HISTORY */}
        {activeTab==='history'&&<section>
          <SecTitle accent={accent}>Season History</SecTitle>
          {seasons.length===0?<Empty>No archived seasons yet.</Empty>:(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {seasons.map(s=>{
                const champ=tMap[s.champion_team_id??'']
                const isOpen=selectedSeasonId===s.id
                return(
                  <div key={s.id} style={{background:'#0A0A0E',border:`1px solid ${isOpen?accent+'44':'#1C1C26'}`,borderRadius:12,overflow:'hidden',transition:'border-color 0.2s'}}>
                    <button onClick={()=>{if(isOpen){setSelectedSeasonId(null)}else{loadSeason(s.id)}}}
                      style={{width:'100%',background:'none',border:'none',padding:'18px 20px',cursor:'pointer',display:'flex',alignItems:'center',gap:14,textAlign:'left' as const}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,textTransform:'uppercase',color:'#EEEEF5',letterSpacing:0.5}}>{s.name}</div>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap' as const,marginTop:4,fontSize:12,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>
                          {s.start_date&&s.end_date&&<span>{s.start_date.slice(0,7)} → {s.end_date.slice(0,7)}</span>}
                          {champ&&<span style={{color:'#F5C542'}}>🏆 {champ.name}</span>}
                          {s.notes&&<span>{s.notes}</span>}
                        </div>
                      </div>
                      <span style={{color:isOpen?accent:'#2E2E3A',fontSize:18,transition:'transform 0.2s',display:'inline-block',transform:isOpen?'rotate(90deg)':'rotate(0deg)'}}>›</span>
                    </button>
                    {isOpen&&(
                      <div style={{borderTop:'1px solid #1C1C26',padding:'20px'}}>
                        {loadingSeason?<div style={{textAlign:'center',padding:'24px 0',color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontSize:13}}>Loading…</div>:(
                          <>
                            {champ&&(
                              <div style={{display:'flex',alignItems:'center',gap:12,background:`${accent}10`,border:`1px solid ${accent}30`,borderRadius:10,padding:'12px 16px',marginBottom:20}}>
                                <span style={{fontSize:24}}>🏆</span>
                                <div>
                                  <div style={{fontSize:11,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:'uppercase' as const,marginBottom:2}}>Champion</div>
                                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:'uppercase',color:'#EEEEF5'}}>{champ.name}</div>
                                </div>
                              </div>
                            )}
                            {/* Standings */}
                            {(()=>{
                              const std=computeSeasonStandings(seasonGames)
                              if(std.length===0) return <Empty>No final games recorded for this season.</Empty>
                              return(
                                <div style={{marginBottom:20}}>
                                  <div style={{fontSize:12,fontWeight:600,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",textTransform:'uppercase' as const,letterSpacing:1,marginBottom:10}}>Standings</div>
                                  <div style={{overflowX:'auto'}}>
                                    <table style={{width:'100%',borderCollapse:'collapse',minWidth:320}}>
                                      <thead><tr style={{borderBottom:'1px solid #1C1C26'}}>
                                        <th style={{textAlign:'left' as const,padding:'6px 10px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontWeight:400}}>#</th>
                                        <th style={{textAlign:'left' as const,padding:'6px 10px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontWeight:400}}>Team</th>
                                        <th style={{textAlign:'center' as const,padding:'6px 10px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontWeight:400}}>W</th>
                                        <th style={{textAlign:'center' as const,padding:'6px 10px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontWeight:400}}>L</th>
                                        <th style={{textAlign:'center' as const,padding:'6px 10px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontWeight:400}}>PCT</th>
                                        <th style={{textAlign:'center' as const,padding:'6px 10px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontWeight:400}}>PF</th>
                                        <th style={{textAlign:'center' as const,padding:'6px 10px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontWeight:400}}>PA</th>
                                      </tr></thead>
                                      <tbody>
                                        {std.map((row,ri)=>{
                                          const gp=row.wins+row.losses
                                          const pct=gp>0?(row.wins/gp).toFixed(3):'—'
                                          const isChamp=row.team_id===s.champion_team_id
                                          return(<tr key={row.team_id} style={{borderBottom:'1px solid #0F0F14',background:isChamp?`${accent}08`:'transparent'}}>
                                            <td style={{padding:'8px 10px',fontSize:13,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>{ri+1}</td>
                                            <td style={{padding:'8px 10px',display:'flex',alignItems:'center',gap:8}}>
                                              <span style={{width:8,height:8,borderRadius:'50%',background:row.color,display:'inline-block',flexShrink:0}}/>
                                              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase',color:isChamp?accent:'#EEEEF5'}}>{row.team_name}</span>
                                              {isChamp&&<span style={{fontSize:12}}>🏆</span>}
                                            </td>
                                            <td style={{textAlign:'center' as const,padding:'8px 10px',fontFamily:"'DM Mono',monospace",fontSize:13,color:accent,fontWeight:600}}>{row.wins}</td>
                                            <td style={{textAlign:'center' as const,padding:'8px 10px',fontFamily:"'DM Mono',monospace",fontSize:13,color:'#C8C8D4'}}>{row.losses}</td>
                                            <td style={{textAlign:'center' as const,padding:'8px 10px',fontFamily:"'DM Mono',monospace",fontSize:13,color:'#EEEEF5'}}>{pct}</td>
                                            <td style={{textAlign:'center' as const,padding:'8px 10px',fontFamily:"'DM Mono',monospace",fontSize:13,color:'#C8C8D4'}}>{row.pts_for}</td>
                                            <td style={{textAlign:'center' as const,padding:'8px 10px',fontFamily:"'DM Mono',monospace",fontSize:13,color:'#C8C8D4'}}>{row.pts_against}</td>
                                          </tr>)
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )
                            })()}
                            {/* Top scorers */}
                            {(()=>{
                              const sp=computeStats(seasonStats,pMap,tMap)
                              if(sp.length===0) return null
                              const top5=sp.slice().sort((a,b)=>b.ppg-a.ppg).slice(0,5)
                              return(
                                <div>
                                  <div style={{fontSize:12,fontWeight:600,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",textTransform:'uppercase' as const,letterSpacing:1,marginBottom:10}}>Top Scorers</div>
                                  {top5.map((p,pi)=>(
                                    <div key={p.player_id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #0F0F14'}}>
                                      <span style={{width:22,textAlign:'center' as const,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#C8C8D4'}}>{pi+1}</span>
                                      <span style={{width:8,height:8,borderRadius:'50%',background:p.team_color,display:'inline-block',flexShrink:0}}/>
                                      <span style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,textTransform:'uppercase',color:'#EEEEF5'}}>{p.display_name}</span>
                                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,color:accent,fontWeight:600}}>{p.ppg.toFixed(1)}</span>
                                      <span style={{fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>PPG</span>
                                    </div>
                                  ))}
                                </div>
                              )
                            })()}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>}

      </main>
      <footer style={{borderTop:'1px solid #12121C',marginTop:40,padding:'32px 24px',textAlign:'center' as const}}>
        <div style={{fontSize:10,color:'#2E2E3A',fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:'uppercase' as const}}>
          Powered by <a href="https://www.netr.pro" style={{color:accent,textDecoration:'none',fontWeight:700}}>NETR</a> · The Modern League Platform
        </div>
      </footer>

      {/* LIGHTBOX */}
      {lightboxIdx!==null&&galleryPhotos[lightboxIdx]&&(
        <div onClick={()=>setLightboxIdx(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <button onClick={e=>{e.stopPropagation();setLightboxIdx(i=>i!==null&&i>0?i-1:galleryPhotos.length-1)}}
            style={{position:'absolute',left:20,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',fontSize:28,width:48,height:48,borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,maxWidth:'90vw'}}>
            <img src={galleryPhotos[lightboxIdx].photo_url} alt={galleryPhotos[lightboxIdx].caption??''} onClick={e=>e.stopPropagation()} style={{maxHeight:'82vh',maxWidth:'90vw',objectFit:'contain',borderRadius:10,boxShadow:'0 0 60px rgba(0,0,0,0.8)'}}/>
            {galleryPhotos[lightboxIdx].caption&&<div style={{fontSize:14,color:'#C8C8D4',fontFamily:"'DM Sans',sans-serif",textAlign:'center'}}>{galleryPhotos[lightboxIdx].caption}</div>}
            <div style={{fontSize:12,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>{lightboxIdx+1} / {galleryPhotos.length}</div>
          </div>
          <button onClick={e=>{e.stopPropagation();setLightboxIdx(i=>i!==null&&i<galleryPhotos.length-1?i+1:0)}}
            style={{position:'absolute',right:20,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',fontSize:28,width:48,height:48,borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
        </div>
      )}

      {/* BOX SCORE MODAL */}
      {boxGame&&(
        <Modal onClose={()=>setBoxGameId(null)}>
          <div style={{textAlign:'center',marginBottom:20,paddingBottom:20,borderBottom:'1px solid #1C1C26'}}>
            <div style={{fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",marginBottom:10}}>{fmtDate(boxGame.scheduled_at)} · Final</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16}}>
              <div style={{textAlign:'right',minWidth:110,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:'uppercase',color:(boxGame.home_score??0)>(boxGame.away_score??0)?'#EEEEF5':'#A0A0B8'}}>{tMap[boxGame.home_team_id]?.name??'—'}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:44,fontWeight:900,display:'flex',alignItems:'center',gap:10}}>
                <span style={{color:(boxGame.home_score??0)>(boxGame.away_score??0)?accent:'#C8C8D4'}}>{boxGame.home_score??0}</span>
                <span style={{color:'#2E2E3A',fontSize:24}}>–</span>
                <span style={{color:(boxGame.away_score??0)>(boxGame.home_score??0)?accent:'#C8C8D4'}}>{boxGame.away_score??0}</span>
              </div>
              <div style={{textAlign:'left',minWidth:110,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:'uppercase',color:(boxGame.away_score??0)>(boxGame.home_score??0)?'#EEEEF5':'#A0A0B8'}}>{tMap[boxGame.away_team_id]?.name??'—'}</div>
            </div>
          </div>
          {[boxGame.home_team_id,boxGame.away_team_id].map(tid=>{
            const team=tMap[tid],tStats=boxStats.filter(s=>s.team_id===tid).sort((a,b)=>b.points-a.points)
            const hasShooting=tStats.some(s=>s.field_goals_attempted>0)
            if(!team) return null
            return(<div key={tid} style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><div style={{width:10,height:10,borderRadius:'50%',background:team.color}}/><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:'uppercase'}}>{team.name}</span></div>
              {tStats.length===0?<div style={{fontSize:13,color:'#C8C8D4'}}>No stats entered.</div>:(
                <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:hasShooting?460:320}}>
                  <thead><tr style={{borderBottom:'1px solid #1C1C26'}}>
                    <th style={{...TH,textAlign:'left',fontSize:9}}>Player</th>
                    {['PTS','REB','AST','STL','BLK','TO'].map(h=><th key={h} style={{...TH,fontSize:9}}>{h}</th>)}
                    {hasShooting&&['FG','3P','FT'].map(h=><th key={h} style={{...TH,fontSize:9}}>{h}</th>)}
                  </tr></thead>
                  <tbody>{tStats.map(s=>{
                    const pl=pMap[s.player_id]
                    return(<tr key={s.player_id} style={{borderBottom:'1px solid #0D0D12'}}>
                      <td style={{...TD,textAlign:'left'}}><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,textTransform:'uppercase'}}>{pl?.display_name??'—'}</span>{pl?.jersey_number&&<span style={{color:'#C8C8D4',fontFamily:"'DM Mono',monospace",fontSize:11,marginLeft:6}}>#{pl.jersey_number}</span>}</td>
                      <td style={{...TD,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:s.points>0?accent:'#C8C8D4'}}>{s.points}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.rebounds}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.assists}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.steals}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.blocks}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13,color:s.turnovers>3?'#FF453A':'#A0A0B8'}}>{s.turnovers}</td>
                      {hasShooting&&<><td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#EEEEF5'}}>{s.field_goals_made}/{s.field_goals_attempted}</td><td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#EEEEF5'}}>{s.three_pointers_made}/{s.three_pointers_attempted}</td><td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#EEEEF5'}}>{s.free_throws_made}/{s.free_throws_attempted}</td></>}
                    </tr>)
                  })}</tbody>
                </table></div>
              )}
            </div>)
          })}
        </Modal>
      )}

      {/* TEAM MODAL */}
      {modalTeam&&(
        <Modal onClose={()=>setTeamModalId(null)}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,paddingBottom:20,borderBottom:'1px solid #1C1C26'}}>
            {modalTeam.logo_url?<img src={modalTeam.logo_url} alt={modalTeam.name} style={{width:64,height:64,borderRadius:10,objectFit:'cover',border:`2px solid ${accent}`,flexShrink:0}}/>:<div style={{width:64,height:64,borderRadius:10,background:modalTeam.color,boxShadow:`0 0 20px ${modalTeam.color}44`,flexShrink:0}}/>}
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:'uppercase',lineHeight:1,marginBottom:8}}>{modalTeam.name}</div>
              {sMap[modalTeam.id]&&<div style={{display:'flex',gap:16}}>
                {[['WINS',sMap[modalTeam.id].wins,accent],['LOSSES',sMap[modalTeam.id].losses,'#C8C8D4'],['PF',sMap[modalTeam.id].pts_for,'#EEEEF5']].map(([lbl,val,col])=>(
                  <div key={String(lbl)} style={{textAlign:'center'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,color:String(col),lineHeight:1}}>{val}</div><div style={{fontSize:10,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",letterSpacing:1}}>{lbl}</div></div>
                ))}
              </div>}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <CalendarButtons slug={league.slug} teamId={modalTeam.id} size="sm"/>
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,color:'#C8C8D4',marginBottom:10}}>Roster</div>
          {modalPlayers.length===0?<div style={{fontSize:13,color:'#C8C8D4'}}>No players yet.</div>:(
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:modalPStats.length>0?400:200}}>
              <thead><tr style={{borderBottom:'1px solid #1C1C26'}}>
                <th style={{...TH,fontSize:9,width:36}}>#</th>
                <th style={{...TH,textAlign:'left',fontSize:9}}>Player</th>
                {modalPStats.length>0&&['GP','PTS','REB','AST','STL','BLK'].map(h=><th key={h} style={{...TH,fontSize:9,color:h==='PTS'?accent:undefined}}>{h}</th>)}
              </tr></thead>
              <tbody>{modalPlayers.map(p=>{
                const ps=modalPStats.find(s=>s.player_id===p.id)
                return(<tr key={p.id} style={{borderBottom:'1px solid #0D0D12'}}>
                  <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#C8C8D4'}}>{p.jersey_number??'—'}</td>
                  <td style={{...TD,textAlign:'left'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase'}}>{p.display_name}</div>{p.position&&<div style={{fontSize:10,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>{p.position}</div>}</td>
                  {modalPStats.length>0&&<>
                    <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#C8C8D4'}}>{ps?.gp??0}</td>
                    <td style={{...TD,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:17,color:ps?.ppg?accent:'#3A3A4E'}}>{ps?.ppg??'—'}</td>
                    <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{ps?.rpg??'—'}</td>
                    <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{ps?.apg??'—'}</td>
                    <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{ps?.spg??'—'}</td>
                    <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{ps?.bpg??'—'}</td>
                  </>}
                </tr>)
              })}</tbody>
            </table></div>
          )}
        </Modal>
      )}
    </div>
  </>)
}

function IgIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function XIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4 L20 20 M20 4 L4 20"/>
    </svg>
  )
}
function FbIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
    </svg>
  )
}
function TtIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
    </svg>
  )
}
function YtIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="4"/>
      <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function SocialIcons({links,accent}:{links:Record<string,string>;accent:string}) {
  const defs:{[k:string]:{icon:React.ReactNode;label:string;color:string;url:(h:string)=>string}} = {
    instagram:{icon:<IgIcon/>,label:'Instagram',color:'#E1306C',url:h=>`https://instagram.com/${h}`},
    twitter:  {icon:<XIcon/>, label:'X / Twitter',color:'#E7E9EA',url:h=>`https://twitter.com/${h}`},
    facebook: {icon:<FbIcon/>,label:'Facebook',  color:'#1877F2',url:h=>`https://facebook.com/${h}`},
    tiktok:   {icon:<TtIcon/>,label:'TikTok',    color:'#69C9D0',url:h=>`https://tiktok.com/@${h}`},
    youtube:  {icon:<YtIcon/>,label:'YouTube',   color:'#FF0000',url:h=>`https://youtube.com/@${h}`},
    website:  {icon:<Globe size={18}/>,label:'Website',color:accent,url:h=>h},
  }
  return(
    <>
      {Object.entries(links).filter(([,v])=>v).map(([k,handle])=>{
        const d=defs[k]; if(!d) return null
        return(
          <a key={k} href={d.url(handle)} target="_blank" rel="noopener noreferrer" title={d.label}
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:34,height:34,borderRadius:10,background:`${d.color}18`,border:`1px solid ${d.color}44`,color:d.color,textDecoration:'none',flexShrink:0,transition:'background 0.2s'}}>
            {d.icon}
          </a>
        )
      })}
    </>
  )
}

function CalendarButtons({slug,teamId,size}:{slug:string;teamId?:string;size:'sm'|'lg'}) {
  const host=typeof window!=='undefined'?window.location.host:''
  const qs=teamId?`?team=${teamId}`:''
  const pad=size==='lg'?'9px 16px':'7px 12px'
  const fs=size==='lg'?13:12
  const btn:React.CSSProperties={display:'inline-flex',alignItems:'center',gap:5,background:'#0F0F14',border:'1px solid #2E2E3A',borderRadius:8,color:'#EEEEF5',fontSize:fs,fontFamily:"'DM Sans',sans-serif",padding:pad,textDecoration:'none',whiteSpace:'nowrap'}
  return(
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <a href={`webcal://${host}/api/league/${slug}/calendar${qs}`} style={btn}>🍎 iPhone / Apple</a>
      <a href={`https://calendar.google.com/calendar/r?cid=https://${host}/api/league/${slug}/calendar${qs}`} target="_blank" rel="noopener noreferrer" style={btn}>📆 Google</a>
      <a href={`/api/league/${slug}/calendar${qs}`} target="_blank" rel="noopener noreferrer" style={{...btn,background:'transparent',border:'1px solid #1C1C26',color:'#C8C8D4'}}>↓ .ics</a>
    </div>
  )
}

function RsvpRow({gameId,myStatus,accent,onRsvp}:{gameId:string;myStatus:'yes'|'no'|'maybe'|null;accent:string;onRsvp:(id:string,s:'yes'|'no'|'maybe')=>void}) {
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px 10px',background:'#0A0A0D',borderRadius:'0 0 10px 10px',borderLeft:'1px solid #1C1C26',borderRight:'1px solid #1C1C26',borderBottom:'1px solid #1C1C26',marginTop:-2}}>
      <span style={{fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",marginRight:4}}>RSVP:</span>
      {(['yes','no','maybe'] as const).map(s=>(
        <button key={s} onClick={()=>onRsvp(gameId,s)} style={{background:myStatus===s?(s==='yes'?`${accent}22`:s==='no'?'rgba(255,68,85,0.15)':'rgba(245,197,66,0.15)'):'transparent',border:`1px solid ${myStatus===s?(s==='yes'?accent:s==='no'?'#FF4455':'#F5C542'):'#2E2E3A'}`,borderRadius:99,color:myStatus===s?(s==='yes'?accent:s==='no'?'#FF4455':'#F5C542'):'#6A6A82',fontSize:11,fontFamily:"'DM Mono',monospace",padding:'3px 10px',cursor:'pointer'}}>
          {s==='yes'?'✓ In':s==='no'?'✗ Out':'? Maybe'}
        </button>
      ))}
    </div>
  )
}

function GCard({g,tMap,accent,onClick,showLoc,rsvpCount}:{g:Game;tMap:Record<string,Team>;accent:string;onClick?:()=>void;showLoc?:boolean;rsvpCount?:number}) {
  const home=tMap[g.home_team_id],away=tMap[g.away_team_id],fin=g.status==='final',cancelled=g.status==='cancelled',homeWon=(g.home_score??0)>(g.away_score??0)
  const d=new Date(g.scheduled_at)
  const dayStr=d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()
  const dateNum=d.getDate()
  const timeStr=d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})
  return(
    <div onClick={onClick} style={{position:'relative',overflow:'hidden',borderRadius:14,cursor:onClick?'pointer':'default',transition:'transform 0.15s,box-shadow 0.15s'}}
      onMouseEnter={e=>{if(onClick){e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow=`0 8px 32px ${accent}20`}}}
      onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}>
      {/* Subtle team color washes */}
      <div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,${home?.color??'#1C1C26'}18 0%,transparent 45%,${away?.color??'#1C1C26'}18 100%)`,pointerEvents:'none'}}/>
      <div style={{position:'relative',display:'grid',gridTemplateColumns:'1fr auto 1fr',alignItems:'center',background:'#0D0D12',border:`1px solid ${fin?accent+'22':'#1C1C26'}`,borderRadius:14,overflow:'hidden'}}>
        {/* Home */}
        <div style={{padding:'16px 14px 16px 18px',display:'flex',flexDirection:'column',gap:4}}>
          {home?.logo_url
            ?<img src={home.logo_url} alt={home.name} style={{width:32,height:32,borderRadius:6,objectFit:'cover',marginBottom:4}}/>
            :<div style={{width:32,height:32,borderRadius:8,background:home?.color??'#2E2E3A',boxShadow:`0 0 12px ${home?.color??'#2E2E3A'}55`,marginBottom:4,flexShrink:0}}/>}
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,textTransform:'uppercase',lineHeight:1.1,color:fin?(homeWon?'#EEEEF5':'#A0A0B8'):'#EEEEF5'}}>{home?.name??'TBD'}</div>
          {fin&&homeWon&&<div style={{fontSize:9,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:'uppercase'}}>WINNER</div>}
        </div>
        {/* Center */}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'0 10px',minWidth:80}}>
          {fin?(
            <>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:36,lineHeight:1,display:'flex',alignItems:'center',gap:6}}>
                <span style={{color:homeWon?accent:'#3A3A4E'}}>{g.home_score??0}</span>
                <span style={{color:'#1C1C26',fontSize:18}}>–</span>
                <span style={{color:!homeWon?accent:'#3A3A4E'}}>{g.away_score??0}</span>
              </div>
              <div style={{fontSize:9,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:2,marginTop:2}}>FINAL{onClick&&' · TAP'}</div>
            </>
          ):cancelled?(
            <div style={{fontSize:11,color:'#FF4455',fontFamily:"'DM Mono',monospace",letterSpacing:1,textAlign:'center'}}>CANCELLED</div>
          ):(
            <>
              <div style={{fontSize:9,color:'#C8C8D4',fontFamily:"'DM Mono',monospace",letterSpacing:1}}>{dayStr}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:28,color:'#2E2E3A',lineHeight:1}}>{dateNum}</div>
              <div style={{fontSize:10,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>{timeStr}</div>
              {rsvpCount!=null&&rsvpCount>0&&<div style={{fontSize:9,color:accent,fontFamily:"'DM Mono',monospace",marginTop:2}}>✓{rsvpCount}</div>}
            </>
          )}
        </div>
        {/* Away */}
        <div style={{padding:'16px 18px 16px 14px',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:4}}>
          {away?.logo_url
            ?<img src={away.logo_url} alt={away.name} style={{width:32,height:32,borderRadius:6,objectFit:'cover',marginBottom:4}}/>
            :<div style={{width:32,height:32,borderRadius:8,background:away?.color??'#2E2E3A',boxShadow:`0 0 12px ${away?.color??'#2E2E3A'}55`,marginBottom:4,flexShrink:0}}/>}
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,textTransform:'uppercase',lineHeight:1.1,textAlign:'right',color:fin?(!homeWon?'#EEEEF5':'#A0A0B8'):'#EEEEF5'}}>{away?.name??'TBD'}</div>
          {fin&&!homeWon&&<div style={{fontSize:9,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:2,textTransform:'uppercase'}}>WINNER</div>}
        </div>
      </div>
      {showLoc&&g.location&&<div style={{background:'#080810',borderLeft:`1px solid #1C1C26`,borderRight:'1px solid #1C1C26',borderBottom:'1px solid #1C1C26',borderRadius:'0 0 14px 14px',padding:'5px 18px',fontSize:11,color:'#C8C8D4',fontFamily:"'DM Mono',monospace"}}>📍 {g.location}</div>}
    </div>
  )
}

function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}) {
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h)},[onClose])
  return(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 16px',overflowY:'auto'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div style={{background:'#0F0F14',border:'1px solid #2E2E3A',borderRadius:16,padding:'28px 24px',width:'100%',maxWidth:660,position:'relative',maxHeight:'90vh',overflowY:'auto'}}>
      <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'none',border:'1px solid #2E2E3A',borderRadius:8,color:'#C8C8D4',fontSize:16,width:32,height:32,cursor:'pointer'}}>✕</button>
      {children}
    </div>
  </div>)
}

function SecTitle({children,accent,noMargin}:{children:React.ReactNode;accent:string;noMargin?:boolean}) {
  return(<h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,textTransform:'uppercase',letterSpacing:1,marginBottom:noMargin?0:18,color:'#EEEEF5',display:'flex',alignItems:'center',gap:12}}>
    <span style={{display:'inline-block',width:4,height:22,background:accent,borderRadius:2,flexShrink:0,boxShadow:`0 0 8px ${accent}88`}}/>{children}
  </h2>)
}
function SectionLabel({children,accent,noMargin}:{children:string;accent:string;noMargin?:boolean}) {
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:noMargin?0:20}}>
      <div style={{height:2,width:24,background:accent,borderRadius:2,flexShrink:0}}/>
      <span style={{fontSize:10,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:3,textTransform:'uppercase' as const}}>{children}</span>
    </div>
  )
}
function Chip({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return<span style={{background:'rgba(255,255,255,0.06)',color:'#EEEEF5',fontSize:11,padding:'5px 12px',borderRadius:99,fontFamily:"'DM Mono',monospace",border:'1px solid rgba(255,255,255,0.08)',...style}}>{children}</span>
}
function Empty({children}:{children:React.ReactNode}) {
  return<div style={{color:'#3A3A4E',fontSize:13,padding:'32px 0',textAlign:'center' as const,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>{children}</div>
}
function Spinner() {
  return<div style={{minHeight:'100vh',background:'#040406',display:'flex',alignItems:'center',justifyContent:'center'}}>
    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,color:'#39FF14',letterSpacing:4,textTransform:'uppercase' as const,opacity:0.8}}>Loading…</div>
  </div>
}
function NotFound() {
  return<div style={{minHeight:'100vh',background:'#040406',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",color:'#EEEEF5',padding:24}}>
    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:96,color:'#0F0F14',fontWeight:900,lineHeight:1}}>404</div>
    <div style={{fontSize:16,color:'#C8C8D4',marginTop:8,fontFamily:"'DM Mono',monospace",letterSpacing:2}}>LEAGUE NOT FOUND</div>
    <a href="https://netrrating.com" style={{color:'#39FF14',fontSize:12,marginTop:24,fontFamily:"'DM Mono',monospace",textDecoration:'none',letterSpacing:2}}>← NETR.PRO</a>
  </div>
}

function computeStats(stats:RawStat[],pMap:Record<string,Player>,tMap:Record<string,Team>):PStat[] {
  const agg:Record<string,{pts:number;reb:number;ast:number;stl:number;blk:number;gp:number}>={}
  for(const s of stats){
    if(!agg[s.player_id])agg[s.player_id]={pts:0,reb:0,ast:0,stl:0,blk:0,gp:0}
    const a=agg[s.player_id];a.pts+=s.points;a.reb+=s.rebounds;a.ast+=s.assists;a.stl+=s.steals;a.blk+=s.blocks;a.gp++
  }
  return Object.entries(agg).map(([pid,a])=>{
    const p=pMap[pid],t=p?tMap[p.team_id]:null
    const r=(n:number)=>Math.round(n*10)/10
    return{player_id:pid,display_name:p?.display_name??'—',team_id:p?.team_id??'',team_name:t?.name??'—',team_color:t?.color??'#6A6A82',gp:a.gp,ppg:r(a.pts/a.gp),rpg:r(a.reb/a.gp),apg:r(a.ast/a.gp),spg:r(a.stl/a.gp),bpg:r(a.blk/a.gp)}
  })
}

function fmtDate(iso:string){return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
function fmtDateTime(iso:string){return new Date(iso).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
const TH:React.CSSProperties={textAlign:'center',fontSize:10,color:'#C8C8D4',textTransform:'uppercase',letterSpacing:2,fontFamily:"'DM Mono',monospace",fontWeight:400,padding:'10px 10px'}
const TD:React.CSSProperties={padding:'10px 10px',textAlign:'center',fontSize:14}
