import { memo, useId } from "react"

type Point = [number, number, number]
type Face = { points: Point[]; shade: number; neutral: boolean; depth: number; layer: number }
const project = ([x, y, z]: Point) => [174 + x * .87 - z * .72, 137 + x * .26 + z * .35 - y]
const pointString = (points: Point[]) => points.map(p => project(p).join(",")).join(" ")
const add = (a: Point, b: Point): Point => [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
const scale = (p: Point, s: number): Point => [p[0]*s,p[1]*s,p[2]*s]
const cross = (a: Point,b: Point): Point => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
const normalize = (p: Point): Point => scale(p,1/Math.hypot(...p))

// Geometry depends only on `kind`; build it once per kind (the spring alone is thousands of faces).
const built = new Map<string, ReturnType<typeof build>>()

/** Every solid uses the same projection, lighting, and back-to-front face ordering. */
function TechnicalArt({kind,large=false}:{kind:string;large?:boolean}) {
  const id = useId().replace(/:/g,"")
  let art = built.get(kind)
  if(!art){art=build(kind);built.set(kind,art)}
  const {polygons,transform,tip,torque,torqueEnd,torqueAngle,heatOrigins} = art
  return <svg className={`technical-art ${large?"large":""}`} viewBox="0 0 360 180" fill="none" aria-hidden="true">
    <defs>
      <pattern id={`${id}-grid`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="currentColor" opacity=".15"/></pattern>
      <radialGradient id={`${id}-shadow`}><stop stopColor="currentColor" stopOpacity=".17"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="360" height="180" fill={`url(#${id}-grid)`}/>
    <ellipse cx="180" cy="146" rx="105" ry="13" fill={`url(#${id}-shadow)`}/>
    <g transform={transform}>
    <g strokeWidth=".65" strokeLinejoin="round">
      {polygons.map((f,i)=><polygon key={i} points={f.points} fill={f.fill} stroke={f.stroke} strokeOpacity=".65"/>)}
    </g>
    {tip&&<path d={`M${tip[0]} ${tip[1]-30}V${tip[1]}m-4-6 4 6 4-6`} className="art-accent" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>}
    {kind==="shaft"&&<g className="art-accent" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points={torque.map(p=>p.join(",")).join(" ")}/><path d="m-6-4 6 4-6 4" transform={`translate(${torqueEnd.join(" ")}) rotate(${torqueAngle})`}/></g>}
    {kind==="thermal"&&<g className="art-accent" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">{heatOrigins.map(([x,y],i)=><path key={i} d={`M${x} ${y}q-4-7 0-14t0-14m-3 4 3-4 3 4`}/>)}</g>}
    </g>
    <g fill="currentColor" opacity=".5" fontFamily="monospace" fontSize="7"><text x="18" y="166">FIG. {({beam:"01",bracket:"02",shaft:"03",thermal:"04",frame:"05",spring:"06"} as Record<string,string>)[kind]||"06"}</text><text x="342" y="166" textAnchor="end">STATICA LAB</text></g>
  </svg>
}

export default memo(TechnicalArt)

function build(kind:string) {
  const faces: Face[] = []
  let layer = 0
  const face = (points:Point[],shade:number,neutral=false) => {
    // Depth follows the projection's camera direction, not the vertical screen axis.
    faces.push({points,shade,neutral,layer,depth:points.reduce((sum,p)=>sum+p[0]*(.72/.87)+p[1]*(.26*.72/.87+.35)+p[2],0)/points.length})
  }
  const box = (x:number,y:number,z:number,w:number,h:number,d:number,neutral=false) => {
    const p: Point[] = [[x,y,z],[x+w,y,z],[x+w,y,z+d],[x,y,z+d],[x,y+h,z],[x+w,y+h,z],[x+w,y+h,z+d],[x,y+h,z+d]]
    face([p[4],p[5],p[6],p[7]],22,neutral)
    face([p[1],p[2],p[6],p[5]],52,neutral)
    face([p[3],p[7],p[6],p[2]],38,neutral)
  }
  // Toward the viewer, matching the depth used for back-to-front ordering.
  const toCamera: Point = [.72/.87, .26*.72/.87+.35, 1]
  /** `tube` draws an open, back-face-culled run segment (coil wire): caps and far sides are hidden anyway. */
  const cylinder = (start:Point,end:Point,r:number,neutral=false,segments=16,tube=false) => {
    const axis=normalize(add(end,scale(start,-1)))
    const u=normalize(cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0]))
    const v=cross(axis,u)
    const ring = (center:Point) => Array.from({length:segments},(_,i)=>add(center,add(scale(u,r*Math.cos(i*Math.PI*2/segments)),scale(v,r*Math.sin(i*Math.PI*2/segments)))))
    const a=ring(start), b=ring(end)
    if(!tube){face(a,43,neutral);face(b,28,neutral)}
    for(let i=0;i<segments;i++){
      const j=(i+1)%segments
      const mid=(i+.5)*Math.PI*2/segments
      const normal=add(scale(u,Math.cos(mid)),scale(v,Math.sin(mid)))
      if(tube&&normal[0]*toCamera[0]+normal[1]*toCamera[1]+normal[2]*toCamera[2]<0)continue
      face([a[i],b[i],b[j],a[j]],30+19*Math.sin(i*Math.PI*2/segments),neutral)
    }
  }
  const bolt = (x:number,y:number,z:number) => cylinder([x,y,z],[x+4,y,z],3.3,true,6)
  const wall = () => box(-87,0,-32,19,110,64,true)
  let load: Point | null = null
  if(kind==="beam"){
    wall()
    // The beam begins at the wall's front face, not beside a symbolic support.
    box(-68,61,-11,183,15,22)
    box(-68,49,-23,5,39,46,true)
    for(const y of [55,82])for(const z of [-17,17])bolt(-63,y,z)
    load=[107,76,0]
  }else if(kind==="bracket"){
    // Mounting Bracket I's bolted L (D-46): a flange flat on the wall, a bend with an inner radius,
    // and an arm carrying the load 120 mm out; two bolts 15 mm below the top of the flange. Generic
    // proportions (t 6, w 70, H 95, r_i 8 mm), not the challenge's reference design.
    box(-87,0,-50,19,122,100,true) // a wall wider and taller than the flange
    const t=6, w=70, H=95, ri=8, ro=ri+t, x0=-68, y0=12, xEnd=x0+135, zf=w/2
    const arc=(r:number)=>Array.from({length:7},(_,i)=>{
      const angle=Math.PI+i/6*Math.PI/2 // from the flange (left) round to the arm (bottom)
      return [x0+ro+r*Math.cos(angle),y0+ro+r*Math.sin(angle)] as [number,number]
    })
    const inner=arc(ri)
    // Body faces seen from above and in front: flange inner face and top, the inner bend, arm top and end.
    layer = 1
    const across=([x,y]:[number,number]):[Point,Point]=>[[x,y,-zf],[x,y,zf]]
    face([[x0+t,y0+H,-zf],[x0+t,y0+H,zf],[x0+t,y0+ro,zf],[x0+t,y0+ro,-zf]],52)
    face([[x0,y0+H,-zf],[x0+t,y0+H,-zf],[x0+t,y0+H,zf],[x0,y0+H,zf]],22)
    for(let i=0;i<inner.length-1;i++){
      const [a1,a2]=across(inner[i]!),[b1,b2]=across(inner[i+1]!)
      face([a1,b1,b2,a2],52-30*(i+.5)/(inner.length-1))
    }
    face([[x0+ro,y0+t,-zf],[xEnd,y0+t,-zf],[xEnd,y0+t,zf],[x0+ro,y0+t,zf]],22)
    face([[xEnd,y0,-zf],[xEnd,y0+t,-zf],[xEnd,y0+t,zf],[xEnd,y0,zf]],52)
    // Bolt heads and washers on the flange's inner face sit in front of it.
    layer = 2
    for(const z of [-w/4,w/4]){
      cylinder([x0+t,y0+H-15,z],[x0+t+1.2,y0+H-15,z],6,true,16)
      bolt(x0+t+1.2,y0+H-15,z)
    }
    // The near side of the L, drawn last: the profile from the flange top round the bend to the arm tip.
    layer = 3
    const outer=arc(ro).map(([x,y])=>[x,y,zf] as Point)
    face([[x0,y0+H,zf],...outer,[xEnd,y0,zf],[xEnd,y0+t,zf],...[...inner].reverse().map(([x,y])=>[x,y,zf] as Point),[x0+t,y0+H,zf]],38)
    load=[x0+120,y0+t,0]
  }else if(kind==="shaft"){
    // A fixed end block restrains a single shaft; a flange receives the torque.
    box(-106,0,-34,65,9,68,true)
    box(-96,9,-25,32,63,50,true)
    cylinder([-64,44,0],[-57,44,0],20,true,24)
    cylinder([-57,44,0],[104,44,0],10,false,24)
    cylinder([94,44,0],[104,44,0],21,false,32)
    for(const z of [-25,25])cylinder([-48,9,z],[-48,12,z],3,true,6)
    for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const y=44+15*Math.cos(angle),z=15*Math.sin(angle)
      cylinder([104,y,z],[106,y,z],2.1,true,8)
    }
  }else if(kind==="thermal"){
    // Fins are extruded plates, seated on a solid heat spreader and a chip.
    box(-67,0,-39,134,7,78,true)
    box(-49,7,-27,98,5,54,true)
    box(-72,12,-44,144,10,88)
    for(let i=0;i<8;i++)box(-65+i*18,22,-38,4,55,76)
    for(const x of [-64,64])for(const z of [-36,36])cylinder([x,22,z],[x,24,z],2.3,true,8)
  }else if(kind==="frame"){
    // A braced, three-dimensional portal frame with four grounded footplates.
    for(const x of [-74,74])for(const z of [-29,29]){
      box(x-12,0,z-10,24,5,20,true)
      box(x-3,5,z-3,6,94,6)
      for(const dx of [-8,8])cylinder([x+dx,5,z],[x+dx,7,z],2,true,6)
    }
    for(const z of [-29,29]){
      box(-77,99,z-3,154,7,6)
      cylinder([-71,9,z],[71,99,z],2.7)
      cylinder([-71,99,z],[71,9,z],2.7)
    }
    for(const x of [-74,74])box(x-3,99,-29,6,7,58)
    load=[18,106,29]
  }else{
    // A sprung instrument platform: real helical coils between two solid plates.
    box(-49,0,-35,98,9,70,true)
    for(const x of [-29,29])for(const z of [-19,19]){
      cylinder([x,9,z],[x,12,z],10,true)
      cylinder([x,77,z],[x,83,z],10,true)
      const points:Point[]=Array.from({length:61},(_,i)=>{
        const theta=i/60*Math.PI*2*5
        return [x+8*Math.cos(theta),14+i/60*61,z+8*Math.sin(theta)]
      })
      for(let i=1;i<points.length;i++)cylinder(points[i-1],points[i],1.8,false,6,true)
    }
    // The full top plate occludes the spring seats and rear coils beneath it.
    layer = 1
    box(-49,83,-35,98,12,70)
    box(-24,95,-18,48,17,36,true)
    load=[0,112,0]
  }
  const tip = load ? project(load) : null
  const heatOrigins = [-45,-9,27].map(x=>project([x,82,0]))
  const torque = Array.from({length:37},(_,i)=> {
    const angle=-Math.PI*.65+i/36*Math.PI*1.65
    return project([115,44+28*Math.cos(angle),28*Math.sin(angle)])
  })
  const projected = faces.flatMap(f=>f.points.map(project))
  if(tip)projected.push(tip,[tip[0],tip[1]-30])
  if(kind==="thermal")for(const p of heatOrigins)projected.push([p[0],p[1]-28])
  if(kind==="shaft")projected.push(...torque)
  const minX=Math.min(...projected.map(p=>p[0])),maxX=Math.max(...projected.map(p=>p[0]))
  const minY=Math.min(...projected.map(p=>p[1])),maxY=Math.max(...projected.map(p=>p[1]))
  // Fit every complete system (including loads) inside the same padded art area.
  const fit=Math.min(264/(maxX-minX),114/(maxY-minY))
  const transform=`translate(180 94) scale(${fit}) translate(${-(minX+maxX)/2} ${-(minY+maxY)/2})`
  const torqueEnd=torque[torque.length-1],torquePrevious=torque[torque.length-2]
  const torqueAngle=Math.atan2(torqueEnd[1]-torquePrevious[1],torqueEnd[0]-torquePrevious[0])*180/Math.PI
  const polygons = faces.sort((a,b)=>a.layer-b.layer||a.depth-b.depth).map(f=>({
    points:pointString(f.points),
    fill:f.neutral?`color-mix(in srgb, #7d877b ${f.shade}%, #f4f5ef)`:`color-mix(in srgb, currentColor ${f.shade}%, #f7f9f2)`,
    stroke:f.neutral?"#929c8b":"currentColor",
  }))
  return {polygons,transform,tip,torque,torqueEnd,torqueAngle,heatOrigins}
}
