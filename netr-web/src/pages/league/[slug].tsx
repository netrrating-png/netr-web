import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getFontFamily, getFontGF } from '../../lib/league-fonts'

type League = { id:string;name:string;slug:string;sport:string;season:string|null;location:string|null;description:string|null;logo_url:string|null;banner_url:string|null;accent_color:string|null;is_active:boolean;announcement:string|null;contact_info:string|null;social_links:Record<string,string>|null;league_font:string|null;signup_url:string|null;signup_label:string|null }
type Sponsor = { id:string;name:string;logo_url:string|null;website_url:string|null }
type GalleryPhoto = { id:string;photo_url:string;caption:string|null }
type Team = { id:string;name:string;color:string;logo_url:string|null }
type Player = { id:string;display_name:string;jersey_number:string|null;position:string|null;team_id:string }
type Standing = { team_id:string;team_name:string;color:string;wins:number;losses:number;pts_for:number;pts_against:number }
type Game = { id:string;home_team_id:string;away_team_id:string;scheduled_at:string;location:string|null;status:string;home_score:number|null;away_score:number|null;game_type:string|null }
type RawStat = { game_id:string;player_id:string;team_id:string;points:number;rebounds:number;assists:number;steals:number;blocks:number;turnovers:number;field_goals_made:number;field_goals_attempted:number;three_pointers_made:number;three_pointers_attempted:number;free_throws_made:number;free_throws_attempted:number }
type PStat = { player_id:string;display_name:string;team_id:string;team_name:string;team_color:string;gp:number;ppg:number;rpg:number;apg:number;spg:number;bpg:number }
type Tab = 'overview'|'schedule'|'stats'|'teams'|'gallery'
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
  const activeTab:Tab = (['overview','schedule','stats','teams','gallery'].includes(tabParam as string)?tabParam:'overview') as Tab
  const setTab = (t:Tab) => router.replace({pathname:router.pathname,query:{slug,tab:t}},undefined,{shallow:true})

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
    const [sponsorsRes,galleryRes] = await Promise.all([
      supabase.from('league_sponsors').select('id,name,logo_url,website_url').eq('league_id',lg.id).order('display_order'),
      supabase.from('league_gallery_photos').select('id,photo_url,caption').eq('league_id',lg.id).order('created_at',{ascending:false}),
    ])
    setSponsors(sponsorsRes.data??[]);setGalleryPhotos(galleryRes.data??[])
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
    </Head>
    <div style={{minHeight:'100vh',background:'#040406',fontFamily:"'DM Sans',sans-serif",color:'#EEEEF5'}}>

      {/* Hero */}
      <div style={{position:'relative',minHeight:460,background:'#040406',overflow:'hidden',display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
        {league.banner_url&&<img src={league.banner_url} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>}
        {/* Overlays */}
        <div style={{position:'absolute',inset:0,background:`linear-gradient(to bottom,rgba(4,4,6,0.1) 0%,rgba(4,4,6,0.65) 50%,rgba(4,4,6,1) 100%)`}}/>
        <div style={{position:'absolute',inset:0,background:`radial-gradient(ellipse at 0% 100%,${accent}12 0%,transparent 55%)`}}/>
        {/* Content */}
        <div style={{position:'relative',zIndex:1,maxWidth:940,margin:'0 auto',width:'100%',padding:'0 20px 44px'}}>
          {/* Eyebrow */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
            <div style={{height:3,width:36,background:accent,borderRadius:2,flexShrink:0}}/>
            <span style={{fontSize:11,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:3,textTransform:'uppercase'}}>{league.season||league.sport||'League'}</span>
          </div>
          {/* Name + logo */}
          <div style={{display:'flex',alignItems:'flex-end',gap:22,marginBottom:24,flexWrap:'wrap' as const}}>
            {league.logo_url&&<img src={league.logo_url} alt={league.name} style={{width:96,height:96,borderRadius:14,objectFit:'cover',border:`3px solid ${accent}`,flexShrink:0,boxShadow:`0 0 32px ${accent}50`,background:'#0A0A0E'}}/>}
            <h1 style={{fontFamily:displayFont,fontWeight:900,fontSize:'clamp(42px,9vw,96px)',textTransform:'uppercase',lineHeight:0.88,letterSpacing:'-1px',margin:0,wordBreak:'break-word' as const}}>{league.name}</h1>
          </div>
          {/* Meta + CTA row */}
          <div style={{display:'flex',alignItems:'center',flexWrap:'wrap' as const,gap:10}}>
            {league.location&&<Chip>📍 {league.location}</Chip>}
            <Chip style={{background:league.is_active?`${accent}20`:'rgba(106,106,130,0.12)',color:league.is_active?accent:'#6A6A82',border:`1px solid ${league.is_active?`${accent}40`:'transparent'}`}}>{league.is_active?'● Active':'○ Archived'}</Chip>
            {league.contact_info&&<a href={league.contact_info.includes('@')?`mailto:${league.contact_info}`:league.contact_info.startsWith('http')?league.contact_info:`tel:${league.contact_info}`} style={{display:'inline-flex',alignItems:'center',gap:5,background:`${accent}18`,border:`1px solid ${accent}40`,borderRadius:99,padding:'5px 13px',color:accent,fontSize:12,fontFamily:"'DM Sans',sans-serif",textDecoration:'none',whiteSpace:'nowrap' as const}}>✉ Contact Us</a>}
            {league.social_links&&<SocialIcons links={league.social_links} accent={accent}/>}
            {league.signup_url&&(
              <a href={league.signup_url} target="_blank" rel="noopener noreferrer"
                style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:8,background:accent,color:'#040406',fontFamily:displayFont,fontWeight:900,fontSize:17,textTransform:'uppercase',letterSpacing:'1px',padding:'13px 28px',borderRadius:10,textDecoration:'none',flexShrink:0,boxShadow:`0 0 28px ${accent}60`,whiteSpace:'nowrap' as const}}>
                {league.signup_label||'Join the League'} →
              </a>
            )}
          </div>
        </div>
        <div style={{position:'relative',height:3,background:`linear-gradient(90deg,${accent},transparent)`}}/>
      </div>

      {/* Announcement */}
      {league.announcement&&!dismissed&&(
        <div style={{background:`${accent}18`,borderBottom:`1px solid ${accent}40`,padding:'12px 20px'}}>
          <div style={{maxWidth:900,margin:'0 auto',display:'flex',alignItems:'center',gap:12}}>
            <span>📢</span>
            <span style={{flex:1,fontSize:14,lineHeight:1.5}}>{league.announcement}</span>
            <button onClick={()=>setDismissed(true)} style={{background:'none',border:'none',color:'#6A6A82',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 4px'}}>×</button>
          </div>
        </div>
      )}

      {/* Description */}
      {league.description&&(
        <div style={{background:'#0A0A0E',borderBottom:'1px solid #14141C',padding:'14px 20px'}}>
          <div style={{maxWidth:900,margin:'0 auto',fontSize:14,color:'#A0A0B8',lineHeight:1.6}}>{league.description}</div>
        </div>
      )}

      {/* Tabs */}
      <div style={{background:'#0A0A0E',borderBottom:'1px solid #1C1C26',position:'sticky',top:0,zIndex:50}}>
        <div style={{maxWidth:900,margin:'0 auto',display:'flex',overflowX:'auto'}}>
          {([
            ['overview','Overview'],['schedule','Schedule'],['stats','Stats'],['teams','Teams'],
            ...(galleryPhotos.length>0?[['gallery','Gallery']]:[] as [Tab,string][]),
          ] as [Tab,string][]).map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',borderBottom:activeTab===t?`3px solid ${accent}`:'3px solid transparent',color:activeTab===t?accent:'#EEEEF5',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase',letterSpacing:1,padding:'14px 20px',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main style={{maxWidth:900,margin:'0 auto',padding:'28px 16px 64px'}}>

        {/* OVERVIEW — homepage */}
        {activeTab==='overview'&&<>

          {/* About / Mission */}
          {league.description&&(
            <section style={{marginBottom:60}}>
              <SectionLabel accent={accent}>About Us</SectionLabel>
              <p style={{fontFamily:displayFont,fontSize:'clamp(20px,3.5vw,30px)',lineHeight:1.55,color:'#C8C8D4',fontWeight:400,margin:0,maxWidth:700}}>{league.description}</p>
            </section>
          )}

          {/* Gallery strip */}
          {galleryPhotos.length>0&&(
            <section style={{marginBottom:60}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap' as const,gap:8}}>
                <SectionLabel accent={accent} noMargin>Gallery</SectionLabel>
                <button onClick={()=>setTab('gallery')} style={{background:'none',border:'none',color:accent,fontSize:12,fontFamily:"'DM Mono',monospace",cursor:'pointer',letterSpacing:1,textTransform:'uppercase' as const,padding:0}}>View all {galleryPhotos.length} →</button>
              </div>
              <div style={{display:'flex',gap:10,overflowX:'auto',scrollSnapType:'x mandatory',paddingBottom:4,WebkitOverflowScrolling:'touch'} as React.CSSProperties}>
                {galleryPhotos.slice(0,8).map((p,i)=>(
                  <div key={p.id} onClick={()=>{setTab('gallery');setTimeout(()=>setLightboxIdx(i),50)}}
                    style={{width:260,height:190,flexShrink:0,borderRadius:12,overflow:'hidden',cursor:'pointer',scrollSnapAlign:'start',border:'1px solid #1C1C26'}}>
                    <img src={p.photo_url} alt={p.caption??''} style={{width:'100%',height:'100%',objectFit:'cover',transition:'transform 0.3s'}}
                      onMouseEnter={e=>e.currentTarget.style.transform='scale(1.05)'}
                      onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}/>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Upcoming games */}
          <section style={{marginBottom:60}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap' as const,gap:12,marginBottom:20}}>
              <SectionLabel accent={accent} noMargin>Upcoming Games</SectionLabel>
              {myTeamId&&<CalendarButtons slug={league.slug} teamId={myTeamId} size="sm"/>}
            </div>
            {upcoming.length===0?<Empty>No games scheduled yet.</Empty>:(
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {upcoming.slice(0,5).map(g=>(
                  <div key={g.id}>
                    <GCard g={g} tMap={tMap} accent={accent} rsvpCount={attendanceCounts[g.id]||0}/>
                    {myPlayerId&&<RsvpRow gameId={g.id} myStatus={myAttendance[g.id]||null} accent={accent} onRsvp={rsvp}/>}
                  </div>
                ))}
                {upcoming.length>5&&(
                  <button onClick={()=>setTab('schedule')} style={{background:'none',border:'1px solid #1C1C26',borderRadius:10,padding:'14px',color:'#6A6A82',fontSize:13,fontFamily:"'DM Mono',monospace",cursor:'pointer',textAlign:'center' as const,letterSpacing:1}}>
                    VIEW FULL SCHEDULE ({upcoming.length} GAMES) →
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Sponsors */}
          {sponsors.length>0&&(
            <section style={{marginBottom:60}}>
              <SectionLabel accent={accent}>Our Sponsors</SectionLabel>
              <div style={{display:'flex',flexWrap:'wrap' as const,gap:12,alignItems:'center'}}>
                {sponsors.map(sp=>(
                  <a key={sp.id} href={sp.website_url??undefined} target="_blank" rel="noopener noreferrer"
                    style={{display:'flex',alignItems:'center',gap:10,background:'#0F0F14',border:'1px solid #1C1C26',borderRadius:12,padding:'12px 18px',textDecoration:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=accent+'66'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='#1C1C26'}>
                    {sp.logo_url&&<img src={sp.logo_url} alt={sp.name} style={{height:32,maxWidth:80,objectFit:'contain',borderRadius:4,background:'#fff',padding:'2px 6px'}}/>}
                    <span style={{fontFamily:displayFont,fontWeight:700,fontSize:16,textTransform:'uppercase' as const,color:'#EEEEF5'}}>{sp.name}</span>
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
              <div style={{background:'#0F0F14',border:'1px solid #1C1C26',borderRadius:12,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:'#0A0A0E',borderBottom:'1px solid #1C1C26'}}>
                    <th style={TH}>#</th><th style={{...TH,textAlign:'left'}}>Team</th>
                    <th style={TH}>W</th><th style={TH}>L</th><th style={TH}>PCT</th><th style={TH}>PF</th><th style={TH}>PA</th><th style={TH}>DIFF</th>
                  </tr></thead>
                  <tbody>{standings.map((s,i)=>{
                    const gp=s.wins+s.losses,pct=gp>0?(s.wins/gp).toFixed(3).replace(/^0/,''):'.000',diff=s.pts_for-s.pts_against,top=i===0&&s.wins>0
                    return(<tr key={s.team_id} onClick={()=>setTeamModalId(s.team_id)} style={{borderBottom:'1px solid #14141C',background:top?`${accent}08`:'transparent',cursor:'pointer'}}>
                      <td style={{...TD,color:'#6A6A82',fontFamily:"'DM Mono',monospace",fontSize:13}}>{top?'🏆':i+1}</td>
                      <td style={TD}><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0}}/><span style={{fontFamily:displayFont,fontWeight:700,fontSize:16,textTransform:'uppercase' as const,color:top?'#EEEEF5':'#C8C8D4'}}>{s.team_name}</span></div></td>
                      <td style={{...TD,color:accent,fontFamily:displayFont,fontWeight:700,fontSize:18}}>{s.wins}</td>
                      <td style={{...TD,color:'#6A6A82',fontFamily:displayFont,fontWeight:700,fontSize:18}}>{s.losses}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{pct}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.pts_for}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.pts_against}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13,color:diff>0?accent:diff<0?'#FF453A':'#6A6A82'}}>{diff>0?'+':''}{diff}</td>
                    </tr>)
                  })}</tbody>
                </table>
              </div>
            </section>
          )}
          <div style={{background:'#0A0A0E',border:'1px solid #1C1C26',borderRadius:10,padding:'14px 16px',marginBottom:20}}>
            <div style={{fontSize:12,color:'#6A6A82',fontFamily:"'DM Mono',monospace",marginBottom:10,textTransform:'uppercase' as const,letterSpacing:1}}>
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
            <div style={{background:'#0F0F14',border:'1px solid #1C1C26',borderRadius:12,overflow:'hidden',overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:480}}>
                <thead><tr style={{background:'#0A0A0E',borderBottom:'1px solid #1C1C26'}}>
                  <th style={{...TH,textAlign:'left'}}>Player</th>
                  <th style={TH}>GP</th>
                  {(['ppg','rpg','apg','spg','bpg'] as SortKey[]).map(k=>(
                    <th key={k} style={{...TH,cursor:'pointer',color:sortBy===k?accent:'#6A6A82'}} onClick={()=>setSortBy(k)}>
                      {{ppg:'PTS',rpg:'REB',apg:'AST',spg:'STL',bpg:'BLK'}[k]}{sortBy===k?' ▾':''}
                    </th>
                  ))}
                </tr></thead>
                <tbody>{[...pStats].sort((a,b)=>b[sortBy]-a[sortBy]).map((p,i)=>(
                  <tr key={p.player_id} onClick={()=>setTeamModalId(p.team_id)} style={{borderBottom:'1px solid #14141C',cursor:'pointer'}} onMouseEnter={e=>(e.currentTarget.style.background='#14141C')} onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{...TD,textAlign:'left'}}>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase'}}>{p.display_name}</div>
                      <div style={{fontSize:11,color:'#6A6A82',fontFamily:"'DM Mono',monospace",display:'flex',alignItems:'center',gap:5}}><span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:p.team_color}}/>{p.team_name}</div>
                    </td>
                    <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13,color:'#6A6A82'}}>{p.gp}</td>
                    {(['ppg','rpg','apg','spg','bpg'] as SortKey[]).map(k=>(
                      <td key={k} style={{...TD,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:sortBy===k?700:400,fontSize:sortBy===k?18:15,color:sortBy===k?(i===0?accent:'#EEEEF5'):'#A0A0B8'}}>{p[k]}</td>
                    ))}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>}

        {/* TEAMS */}
        {activeTab==='teams'&&<section>
          <SecTitle accent={accent}>Teams</SecTitle>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
            {teams.map(t=>{
              const s=sMap[t.id],cnt=players.filter(p=>p.team_id===t.id).length
              return(<button key={t.id} onClick={()=>setTeamModalId(t.id)} style={{background:'#0F0F14',border:'1px solid #1C1C26',borderRadius:12,padding:'18px 20px',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:14,width:'100%'}}>
                {t.logo_url?<img src={t.logo_url} alt={t.name} style={{width:48,height:48,borderRadius:8,objectFit:'cover',flexShrink:0}}/>:<div style={{width:48,height:48,borderRadius:8,background:t.color,boxShadow:`0 0 16px ${t.color}44`,flexShrink:0}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:'uppercase',marginBottom:4,color:'#EEEEF5'}}>{t.name}</div>
                  <div style={{fontSize:12,color:'#6A6A82',fontFamily:"'DM Mono',monospace"}}>{s?`${s.wins}W – ${s.losses}L`:'0W – 0L'} · {cnt} players</div>
                </div>
                <span style={{color:'#2E2E3A',fontSize:18}}>›</span>
              </button>)
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

      </main>
      <footer style={{borderTop:'1px solid #1C1C26',padding:'20px 24px',textAlign:'center',fontSize:11,color:'#3A3A4E',fontFamily:"'DM Mono',monospace"}}>
        Powered by <a href="https://www.netr.pro" style={{color:'#39FF14',textDecoration:'none',fontWeight:500}}>NETR</a>
      </footer>

      {/* LIGHTBOX */}
      {lightboxIdx!==null&&galleryPhotos[lightboxIdx]&&(
        <div onClick={()=>setLightboxIdx(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.95)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <button onClick={e=>{e.stopPropagation();setLightboxIdx(i=>i!==null&&i>0?i-1:galleryPhotos.length-1)}}
            style={{position:'absolute',left:20,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',fontSize:28,width:48,height:48,borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>‹</button>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,maxWidth:'90vw'}}>
            <img src={galleryPhotos[lightboxIdx].photo_url} alt={galleryPhotos[lightboxIdx].caption??''} onClick={e=>e.stopPropagation()} style={{maxHeight:'82vh',maxWidth:'90vw',objectFit:'contain',borderRadius:10,boxShadow:'0 0 60px rgba(0,0,0,0.8)'}}/>
            {galleryPhotos[lightboxIdx].caption&&<div style={{fontSize:14,color:'#C8C8D4',fontFamily:"'DM Sans',sans-serif",textAlign:'center'}}>{galleryPhotos[lightboxIdx].caption}</div>}
            <div style={{fontSize:12,color:'#4A4A5E',fontFamily:"'DM Mono',monospace"}}>{lightboxIdx+1} / {galleryPhotos.length}</div>
          </div>
          <button onClick={e=>{e.stopPropagation();setLightboxIdx(i=>i!==null&&i<galleryPhotos.length-1?i+1:0)}}
            style={{position:'absolute',right:20,top:'50%',transform:'translateY(-50%)',background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',fontSize:28,width:48,height:48,borderRadius:'50%',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>›</button>
        </div>
      )}

      {/* BOX SCORE MODAL */}
      {boxGame&&(
        <Modal onClose={()=>setBoxGameId(null)}>
          <div style={{textAlign:'center',marginBottom:20,paddingBottom:20,borderBottom:'1px solid #1C1C26'}}>
            <div style={{fontSize:11,color:'#6A6A82',fontFamily:"'DM Mono',monospace",marginBottom:10}}>{fmtDate(boxGame.scheduled_at)} · Final</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:16}}>
              <div style={{textAlign:'right',minWidth:110,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:'uppercase',color:(boxGame.home_score??0)>(boxGame.away_score??0)?'#EEEEF5':'#6A6A82'}}>{tMap[boxGame.home_team_id]?.name??'—'}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:44,fontWeight:900,display:'flex',alignItems:'center',gap:10}}>
                <span style={{color:(boxGame.home_score??0)>(boxGame.away_score??0)?accent:'#6A6A82'}}>{boxGame.home_score??0}</span>
                <span style={{color:'#2E2E3A',fontSize:24}}>–</span>
                <span style={{color:(boxGame.away_score??0)>(boxGame.home_score??0)?accent:'#6A6A82'}}>{boxGame.away_score??0}</span>
              </div>
              <div style={{textAlign:'left',minWidth:110,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,textTransform:'uppercase',color:(boxGame.away_score??0)>(boxGame.home_score??0)?'#EEEEF5':'#6A6A82'}}>{tMap[boxGame.away_team_id]?.name??'—'}</div>
            </div>
          </div>
          {[boxGame.home_team_id,boxGame.away_team_id].map(tid=>{
            const team=tMap[tid],tStats=boxStats.filter(s=>s.team_id===tid).sort((a,b)=>b.points-a.points)
            const hasShooting=tStats.some(s=>s.field_goals_attempted>0)
            if(!team) return null
            return(<div key={tid} style={{marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}><div style={{width:10,height:10,borderRadius:'50%',background:team.color}}/><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,textTransform:'uppercase'}}>{team.name}</span></div>
              {tStats.length===0?<div style={{fontSize:13,color:'#6A6A82'}}>No stats entered.</div>:(
                <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:hasShooting?460:320}}>
                  <thead><tr style={{borderBottom:'1px solid #1C1C26'}}>
                    <th style={{...TH,textAlign:'left',fontSize:9}}>Player</th>
                    {['PTS','REB','AST','STL','BLK','TO'].map(h=><th key={h} style={{...TH,fontSize:9}}>{h}</th>)}
                    {hasShooting&&['FG','3P','FT'].map(h=><th key={h} style={{...TH,fontSize:9}}>{h}</th>)}
                  </tr></thead>
                  <tbody>{tStats.map(s=>{
                    const pl=pMap[s.player_id]
                    return(<tr key={s.player_id} style={{borderBottom:'1px solid #0D0D12'}}>
                      <td style={{...TD,textAlign:'left'}}><span style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:14,textTransform:'uppercase'}}>{pl?.display_name??'—'}</span>{pl?.jersey_number&&<span style={{color:'#6A6A82',fontFamily:"'DM Mono',monospace",fontSize:11,marginLeft:6}}>#{pl.jersey_number}</span>}</td>
                      <td style={{...TD,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:16,color:s.points>0?accent:'#6A6A82'}}>{s.points}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.rebounds}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.assists}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.steals}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13}}>{s.blocks}</td>
                      <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:13,color:s.turnovers>3?'#FF453A':'#A0A0B8'}}>{s.turnovers}</td>
                      {hasShooting&&<><td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#A0A0B8'}}>{s.field_goals_made}/{s.field_goals_attempted}</td><td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#A0A0B8'}}>{s.three_pointers_made}/{s.three_pointers_attempted}</td><td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#A0A0B8'}}>{s.free_throws_made}/{s.free_throws_attempted}</td></>}
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
                {[['WINS',sMap[modalTeam.id].wins,accent],['LOSSES',sMap[modalTeam.id].losses,'#6A6A82'],['PF',sMap[modalTeam.id].pts_for,'#EEEEF5']].map(([lbl,val,col])=>(
                  <div key={String(lbl)} style={{textAlign:'center'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:26,color:String(col),lineHeight:1}}>{val}</div><div style={{fontSize:10,color:'#6A6A82',fontFamily:"'DM Mono',monospace",letterSpacing:1}}>{lbl}</div></div>
                ))}
              </div>}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <CalendarButtons slug={league.slug} teamId={modalTeam.id} size="sm"/>
          </div>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:1,color:'#6A6A82',marginBottom:10}}>Roster</div>
          {modalPlayers.length===0?<div style={{fontSize:13,color:'#6A6A82'}}>No players yet.</div>:(
            <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',minWidth:modalPStats.length>0?400:200}}>
              <thead><tr style={{borderBottom:'1px solid #1C1C26'}}>
                <th style={{...TH,fontSize:9,width:36}}>#</th>
                <th style={{...TH,textAlign:'left',fontSize:9}}>Player</th>
                {modalPStats.length>0&&['GP','PTS','REB','AST','STL','BLK'].map(h=><th key={h} style={{...TH,fontSize:9,color:h==='PTS'?accent:undefined}}>{h}</th>)}
              </tr></thead>
              <tbody>{modalPlayers.map(p=>{
                const ps=modalPStats.find(s=>s.player_id===p.id)
                return(<tr key={p.id} style={{borderBottom:'1px solid #0D0D12'}}>
                  <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#6A6A82'}}>{p.jersey_number??'—'}</td>
                  <td style={{...TD,textAlign:'left'}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase'}}>{p.display_name}</div>{p.position&&<div style={{fontSize:10,color:'#6A6A82',fontFamily:"'DM Mono',monospace"}}>{p.position}</div>}</td>
                  {modalPStats.length>0&&<>
                    <td style={{...TD,fontFamily:"'DM Mono',monospace",fontSize:12,color:'#6A6A82'}}>{ps?.gp??0}</td>
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

function SocialIcons({links,accent}:{links:Record<string,string>;accent:string}) {
  const defs:{[k:string]:{label:string;color:string;url:(h:string)=>string}} = {
    instagram:{label:'IG',color:'#E1306C',url:h=>`https://instagram.com/${h}`},
    twitter:  {label:'𝕏', color:'#1DA1F2',url:h=>`https://twitter.com/${h}`},
    facebook: {label:'f', color:'#1877F2',url:h=>`https://facebook.com/${h}`},
    tiktok:   {label:'TT',color:'#69C9D0',url:h=>`https://tiktok.com/@${h}`},
    youtube:  {label:'▶', color:'#FF0000',url:h=>`https://youtube.com/@${h}`},
    website:  {label:'🔗',color:accent,   url:h=>h},
  }
  return(
    <>
      {Object.entries(links).filter(([,v])=>v).map(([k,handle])=>{
        const d=defs[k]; if(!d) return null
        return(
          <a key={k} href={d.url(handle)} target="_blank" rel="noopener noreferrer" title={d.label}
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:28,height:28,borderRadius:'50%',background:`${d.color}22`,border:`1px solid ${d.color}55`,color:d.color,fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:700,textDecoration:'none',flexShrink:0}}>
            {d.label}
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
      <a href={`/api/league/${slug}/calendar${qs}`} target="_blank" rel="noopener noreferrer" style={{...btn,background:'transparent',border:'1px solid #1C1C26',color:'#4A4A5E'}}>↓ .ics</a>
    </div>
  )
}

function RsvpRow({gameId,myStatus,accent,onRsvp}:{gameId:string;myStatus:'yes'|'no'|'maybe'|null;accent:string;onRsvp:(id:string,s:'yes'|'no'|'maybe')=>void}) {
  return(
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 16px 10px',background:'#0A0A0D',borderRadius:'0 0 10px 10px',borderLeft:'1px solid #1C1C26',borderRight:'1px solid #1C1C26',borderBottom:'1px solid #1C1C26',marginTop:-2}}>
      <span style={{fontSize:11,color:'#6A6A82',fontFamily:"'DM Mono',monospace",marginRight:4}}>RSVP:</span>
      {(['yes','no','maybe'] as const).map(s=>(
        <button key={s} onClick={()=>onRsvp(gameId,s)} style={{background:myStatus===s?(s==='yes'?`${accent}22`:s==='no'?'rgba(255,68,85,0.15)':'rgba(245,197,66,0.15)'):'transparent',border:`1px solid ${myStatus===s?(s==='yes'?accent:s==='no'?'#FF4455':'#F5C542'):'#2E2E3A'}`,borderRadius:99,color:myStatus===s?(s==='yes'?accent:s==='no'?'#FF4455':'#F5C542'):'#6A6A82',fontSize:11,fontFamily:"'DM Mono',monospace",padding:'3px 10px',cursor:'pointer'}}>
          {s==='yes'?'✓ In':s==='no'?'✗ Out':'? Maybe'}
        </button>
      ))}
    </div>
  )
}

function GCard({g,tMap,accent,onClick,showLoc,rsvpCount}:{g:Game;tMap:Record<string,Team>;accent:string;onClick?:()=>void;showLoc?:boolean;rsvpCount?:number}) {
  const home=tMap[g.home_team_id],away=tMap[g.away_team_id],fin=g.status==='final',homeWon=(g.home_score??0)>(g.away_score??0)
  return(<div onClick={onClick} style={{background:'#0F0F14',border:'1px solid #1C1C26',borderRadius:10,padding:'12px 16px',cursor:onClick?'pointer':'default'}} onMouseEnter={e=>{if(onClick)e.currentTarget.style.borderColor=accent+'66'}} onMouseLeave={e=>{if(onClick)e.currentTarget.style.borderColor='#1C1C26'}}>
    <div style={{fontSize:11,color:'#6A6A82',fontFamily:"'DM Mono',monospace",marginBottom:8,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
      {fin?fmtDate(g.scheduled_at):fmtDateTime(g.scheduled_at)}
      {fin&&<span style={{background:`${accent}20`,color:accent,borderRadius:99,padding:'2px 8px',fontSize:10,border:`1px solid ${accent}40`}}>Final</span>}
      {g.status==='cancelled'&&<span style={{background:'rgba(255,68,85,0.1)',color:'#FF4455',borderRadius:99,padding:'2px 8px',fontSize:10}}>Cancelled</span>}
      {showLoc&&g.location&&<span style={{color:'#4A4A5E'}}>📍 {g.location}</span>}
      {!fin&&rsvpCount!=null&&rsvpCount>0&&<span style={{marginLeft:'auto',color:accent,fontSize:10,fontFamily:"'DM Mono',monospace"}}>✓ {rsvpCount} in</span>}
      {onClick&&fin&&<span style={{marginLeft:'auto',color:'#3A3A4E',fontSize:10}}>Box Score ›</span>}
    </div>
    <div style={{display:'flex',alignItems:'center'}}>
      <div style={{flex:1,textAlign:'right',fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase',color:fin?(homeWon?'#EEEEF5':'#6A6A82'):'#EEEEF5'}}>
        {home&&<span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:home.color,marginRight:6,verticalAlign:'middle'}}/>}{home?.name??'—'}
      </div>
      {fin?<div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:22,fontWeight:900,display:'flex',alignItems:'center',gap:4,padding:'0 14px',flexShrink:0}}>
        <span style={{color:homeWon?accent:'#6A6A82'}}>{g.home_score??0}</span><span style={{color:'#2E2E3A',fontSize:14}}>–</span><span style={{color:!homeWon?accent:'#6A6A82'}}>{g.away_score??0}</span>
      </div>:<div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:13,color:'#3A3A4E',fontWeight:700,letterSpacing:1,padding:'0 14px',flexShrink:0}}>VS</div>}
      <div style={{flex:1,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:15,textTransform:'uppercase',color:fin?(!homeWon?'#EEEEF5':'#6A6A82'):'#EEEEF5'}}>
        {away&&<span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:away.color,marginRight:6,verticalAlign:'middle'}}/>}{away?.name??'—'}
      </div>
    </div>
  </div>)
}

function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}) {
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',h);return()=>document.removeEventListener('keydown',h)},[onClose])
  return(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px 16px',overflowY:'auto'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div style={{background:'#0F0F14',border:'1px solid #2E2E3A',borderRadius:16,padding:'28px 24px',width:'100%',maxWidth:660,position:'relative',maxHeight:'90vh',overflowY:'auto'}}>
      <button onClick={onClose} style={{position:'absolute',top:14,right:14,background:'none',border:'1px solid #2E2E3A',borderRadius:8,color:'#6A6A82',fontSize:16,width:32,height:32,cursor:'pointer'}}>✕</button>
      {children}
    </div>
  </div>)
}

function SecTitle({children,accent,noMargin}:{children:React.ReactNode;accent:string;noMargin?:boolean}) {
  return(<h2 style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,textTransform:'uppercase',letterSpacing:0.5,marginBottom:noMargin?0:14,color:'#EEEEF5',display:'flex',alignItems:'center',gap:10}}>
    <span style={{display:'inline-block',width:4,height:20,background:accent,borderRadius:2,flexShrink:0}}/>{children}
  </h2>)
}
function SectionLabel({children,accent,noMargin}:{children:string;accent:string;noMargin?:boolean}) {
  return(
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:noMargin?0:20}}>
      <div style={{height:3,width:36,background:accent,borderRadius:2,flexShrink:0}}/>
      <span style={{fontSize:11,color:accent,fontFamily:"'DM Mono',monospace",letterSpacing:3,textTransform:'uppercase' as const}}>{children}</span>
    </div>
  )
}
function Chip({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return<span style={{background:'rgba(255,255,255,0.08)',color:'#EEEEF5',fontSize:12,padding:'4px 10px',borderRadius:99,fontFamily:"'DM Mono',monospace",...style}}>{children}</span>
}
function Empty({children}:{children:React.ReactNode}) { return<div style={{color:'#6A6A82',fontSize:14,padding:'20px 0'}}>{children}</div> }
function Spinner() { return<div style={{minHeight:'100vh',background:'#040406',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Barlow Condensed',sans-serif",fontSize:24,color:'#39FF14',letterSpacing:2}}>LOADING…</div> }
function NotFound() { return(<div style={{minHeight:'100vh',background:'#040406',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',sans-serif",color:'#EEEEF5',padding:24}}><div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:72,color:'#1C1C26',fontWeight:900,lineHeight:1}}>404</div><div style={{fontSize:18,color:'#6A6A82',marginTop:12}}>League not found.</div><a href="https://netrrating.com" style={{color:'#39FF14',fontSize:14,marginTop:24,fontFamily:"'DM Mono',monospace",textDecoration:'none'}}>← netrrating.com</a></div>) }

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
const TH:React.CSSProperties={textAlign:'center',fontSize:10,color:'#6A6A82',textTransform:'uppercase',letterSpacing:2,fontFamily:"'DM Mono',monospace",fontWeight:400,padding:'10px 10px'}
const TD:React.CSSProperties={padding:'10px 10px',textAlign:'center',fontSize:14}
