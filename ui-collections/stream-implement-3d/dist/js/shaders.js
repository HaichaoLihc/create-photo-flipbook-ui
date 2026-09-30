import { LAYER } from './photos.js';
export const IDLE = 3;

const COMMON = `#version 300 es
precision highp float; precision highp int; precision highp sampler2DArray;
uniform highp sampler2D uFibS, uFibD;
uniform float uCW, uCH, uYB, uTime, uMotion;
uniform vec4 uPluck;      // line, age, amplitude, -
uniform vec4 uHover;      // line, amount, -, -
ivec2 at(int i){ return ivec2(i & 1023, i >> 10); }
float ss(float a, float b, float x){ float t=clamp((x-a)/(b-a),0.,1.); return t*t*(3.-2.*t); }
// Sideways motion of a fibre at height y: wind, the hand that parts it, and a pluck.
// uMotion keeps every movement roughly the same size on screen at any zoom.
float disp(float x0, float y, float idx, vec4 dy){
  float hang=clamp((uCH-y)/uCH,0.,1.);
  float anchor=ss(0.,.18,hang);
  float wind=(sin(uTime*.55+x0*.9+y*.21)*.035+sin(uTime*.31-x0*.37+y*.07)*.05)*hang*uMotion;
  if(abs(idx-uHover.x)<.5) wind*=1.-uHover.y;          // the thread under the hand holds still
  float d=(y-dy.y)/uMotion;
  float push=dy.x*exp(-d*d/(d>0.?3.:10.));
  float pl=0.;
  if(abs(idx-uPluck.x)<.5){
    float dist=(uCH-y)/uMotion, front=uPluck.y*10.;
    pl=uPluck.z*exp(-uPluck.y*1.4)*sin(dist*2.2-uPluck.y*14.)*ss(front+.1,front-2.5,dist);
  }
  return (wind+push+pl)*anchor;
}
`;

const NOISE = `
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int k=0;k<4;k++){ s+=a*vnoise(p); p=p*2.03+17.1; a*=.5; } return s; }
uint pcg(uint v){ uint s=v*747796405u+2891336453u; uint w=((s>>((s>>28u)+4u))^s)*277803737u; return (w>>22u)^w; }
float h2(int a, int b){ return float(pcg(uint(a)*1664525u^pcg(uint(b)+1013904223u)))/4294967295.; }
`;

export const FIBRE_VS = COMMON + NOISE + `
layout(location=0) in vec2 aV;           // x: position along the fibre, y: side
uniform highp sampler2D uStory;
uniform vec3 uCam; uniform float uF, uAspect, uHpx, uMinPx, uMirror, uSpacing;
uniform vec2 uSelect;                    // line, amount
uniform float uIdleL[${IDLE}], uIdleA[${IDLE}];
out float vU, vY, vX0, vSeed, vFlare, vSide, vHalfPx, vQuadPx, vNorm, vCl, vCl2, vSpacePx, vPpu, vXw;
flat out int vId; flat out float vN, vPhase, vHov, vSel, vFlowT; flat out vec3 vCol;
void main(){
  int i=gl_InstanceID;
  float fi=float(i);
  vec4 s=texelFetch(uFibS,at(i),0), dy=texelFetch(uFibD,at(i),0), st=texelFetch(uStory,at(i*3),0);
  const float UV=.86;
  float u=aV.x, flare=0.;
  vec3 p;
  if(u<UV){ p=vec3(s.x, uCH-(uCH-uYB)*(u/UV), 0.); }
  else {
    flare=(u-UV)/(1.-UV);
    float ang=flare*1.5707963, R=.5+s.y*.8+s.w*.55;
    p=vec3(s.x+(s.x/uCW)*flare*flare*2.4+(s.w-.5)*flare*flare*.6, uYB*(1.-sin(ang)), R*(1.-cos(ang)));
  }
  p.x+=disp(s.x,p.y,fi,dy)*(1.-flare*.7);
  float y=p.y;
  if(uMirror>.5) p.y=-p.y;
  float depth=uCam.z-p.z;
  float ppu=uF*uHpx*.5/max(depth,1e-4);
  float spacing=uSpacing*ppu;                         // px between neighbouring threads

  // How much this thread is being looked at: pointed to, glimmering by itself, or chosen.
  float hov=abs(fi-uHover.x)<.5?uHover.y:0.;
  for(int k=0;k<${IDLE};k++) if(abs(fi-uIdleL[k])<.5){ float a=uIdleA[k]; hov=max(hov,ss(0.,.7,a)*ss(3.2,1.8,a)*.85); }
  vHov=hov;
  vSel=abs(fi-uSelect.x)<.5?1.:0.;

  // Threads widen with zoom until each is exactly as wide as its photographs.
  float frac=mix(.14,.8,ss(2.,24.,spacing));
  float halfPx=max(uMinPx*.5,frac*spacing*.5)+hov*.75*(1.-ss(3.,12.,spacing));
  float quadPx=halfPx+1.;
  float off=aV.y*quadPx/ppu;
  p.x+=off;
  gl_Position=vec4((p.x-uCam.x)*uF/uAspect,(p.y-uCam.y)*uF,0.,depth);
  vNorm=clamp(spacing,.07,1.)*(1.+.7*ss(1.5,12.,spacing))*ss(.0,.02,depth/max(uCam.z,1e-4));
  // Light clouds drifting through the curtain, evaluated per vertex and interpolated.
  vCl=fbm(vec2(s.x*.19+uTime*.012, y*.13-uTime*.028));
  vCl2=fbm(vec2(s.x*.85-uTime*.02, y*.42+uTime*.035)+3.7);
  vU=u; vY=y; vX0=s.x; vSeed=s.y; vFlare=flare; vSide=aV.y; vHalfPx=halfPx; vQuadPx=quadPx;
  vSpacePx=spacing; vPpu=ppu; vXw=off; vId=i; vN=st.x; vCol=st.yzw; vPhase=dy.z; vFlowT=dy.w;
}`;

export const FIBRE_FS = COMMON + NOISE + `
uniform sampler2DArray uArr;
uniform highp sampler2D uStory, uLayers;
uniform float uGain, uMirror, uIntro, uW, uS, uDim;
uniform vec2 uSelect;
in float vU, vY, vX0, vSeed, vFlare, vSide, vHalfPx, vQuadPx, vNorm, vCl, vCl2, vSpacePx, vPpu, vXw;
flat in int vId; flat in float vN, vPhase, vHov, vSel, vFlowT; flat in vec3 vCol;
out vec4 o;
void main(){
  float dist=abs(vSide)*vQuadPx;
  float cov=clamp(vHalfPx+.5-dist,0.,1.)*min(1.,vHalfPx*2.);
  if(cov<=0.) discard;
  float y=vY, cl=vCl, cl2=vCl2;

  // The curtain: mostly blue, drifting into lavender where the light clouds gather.
  vec3 blue=vec3(.2,.32,.95), violet=vec3(.5,.38,.98), ice=vec3(.66,.84,1.);
  vec3 col=mix(blue,violet,ss(.5,.78,cl));
  float I=.38+.8*ss(.25,.85,cl)+.3*cl2;
  float pleat=.62+.38*(.55+.3*cos(vX0*2.7+.8)+.15*cos(vX0*6.3+2.1));
  I*=(.3+1.35*vSeed*vSeed)*pleat;
  I*=1.+1.4*exp(-(uCH-y)*3.2);
  I*=1.+vFlare*1.3; col=mix(col,ice,vFlare*.45);
  // Water: short bright specks and fine glitter sliding down each fibre.
  float q=(y+vFlowT*(.8+vSeed*.5))*5.5;
  float f=fract(q);
  float speck=step(.972,h2(vId,int(floor(q))))*ss(0.,.12,f)*ss(.6,.15,f);
  float q2=(y+vFlowT*(1.1+vSeed*.3))*21.;
  float glit=step(.93,h2(vId+7919,int(floor(q2))))*ss(.5,0.,abs(fract(q2)-.5));
  float calm=1.-ss(10.,60.,vSpacePx);                 // specks would be metres long up close
  vec3 c=(col*I+ice*(speck*3.2+glit*.8)*(.3+cl)*calm)*vNorm*uGain;
  c+=ice*ss(.97,1.,vU)*2.6*vNorm*uGain;

  // The stream: this thread's story, one photograph after another, flowing down.
  float reveal=max(ss(2.,10.,vSpacePx),vHov);
  if(reveal>.002 && vFlare<=0.){
    float sc=(uCH-y)-vPhase;
    float slot=floor(sc/uS), local=sc-slot*uS;
    int n=max(int(vN+.5),1);
    int ch=int(mod(slot,float(n)));
    vec4 L=texelFetch(uStory,at(vId*3+1+ch/4),0);
    int cc=ch-(ch/4)*4;
    float layer=cc==0?L.x:cc==1?L.y:cc==2?L.z:L.w;
    float aspect=texelFetch(uLayers,ivec2(int(layer),0),0).x;
    float h=uW/aspect;
    float vp=(local-(uS-h)*.5)/h, up=.5+vXw/uW;
    float slotPx=uS*vPpu;
    float detail=ss(1.2,5.,slotPx);
    vec3 st=vCol*(.5+.35*cl);
    float inside=0., core=1.;
    if(detail>.001){
      float lod=log2(max(1.,${LAYER}./(min(uW,h)*vPpu)));
      vec3 img=textureLod(uArr,vec3(clamp(up,0.,1.),clamp(vp,0.,1.),layer),lod).rgb;
      float e=1./max(h*vPpu,1.);
      inside=ss(0.,e,vp)*ss(1.,1.-e,vp)*ss(uYB,uYB+3.*uS,y)*ss(uCH,uCH-2.*uS,y);
      // Between moments only the thread itself remains, a hairline in its story's colour.
      core=clamp(1.2-abs(vXw)*vPpu,0.,1.);
      vec3 thread=vCol*(.3+.25*cl+.5*vHov)*core;
      st=mix(st,mix(thread,img,inside),detail);
    }
    st*=1.+vHov*.25*(1.-detail);
    // The curtain's own light keeps running along the thread between the pictures.
    c=mix(c,st*cov,reveal)+c*core*(1.-inside)*reveal*.75;
  }

  float front=uIntro*8.5-1.;
  c*=ss(front,front-3.,uCH-y);
  c*=vHov>.01?1.:1.-uDim;
  c*=mix(1.-uSelect.y,1.+uSelect.y*1.2,vSel);
  if(uMirror>.5) c*=exp(-y*.3)*(.55+.45*cl2);
  o=vec4(c,0.);
}`;

export const FLOOR_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aC;
uniform vec3 uCam; uniform float uF, uAspect, uCW;
out vec3 vP;
void main(){
  vec3 p=vec3(aC.x*(uCW*.5+7.),0.,mix(-3.5,10.,aC.y*.5+.5));
  vP=p;
  gl_Position=vec4((p.x-uCam.x)*uF/uAspect,(p.y-uCam.y)*uF,0.,uCam.z-p.z);
}`;

export const FLOOR_FS = `#version 300 es
precision highp float;
` + NOISE + `
uniform float uTime, uCW, uGain, uIntro;
in vec3 vP;
out vec4 o;
float ss(float a,float b,float x){ float t=clamp((x-a)/(b-a),0.,1.); return t*t*(3.-2.*t); }
void main(){
  float edge=ss(uCW*.5+3.5,uCW*.5-1.5,abs(vP.x));
  float fore=exp(-max(vP.z,0.)*.36), back=exp(-max(-vP.z,0.)*1.4);
  float n=fbm(vP.xz*.28+vec2(uTime*.02,-uTime*.015));
  vec3 c=mix(vec3(.1,.2,.95),vec3(.42,.28,1.),ss(.4,.75,n))*edge*fore*back*(.09+.07*n);
  c+=vec3(.5,.66,1.)*exp(-pow(vP.z-1.,2.)*1.2)*edge*.06;
  o=vec4(c*uGain*ss(1.2,3.,uIntro),0.);
}`;

export const POST_VS = `#version 300 es
out vec2 vUv;
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2))*2.-1.; vUv=p*.5+.5; gl_Position=vec4(p,0.,1.); }`;

export const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
vec3 s(float x,float y){ return texture(uSrc,vUv+vec2(x,y)*uTexel).rgb; }
void main(){
  vec3 r=s(0.,0.)*.125
    +(s(-2.,2.)+s(2.,2.)+s(-2.,-2.)+s(2.,-2.))*.03125
    +(s(0.,2.)+s(-2.,0.)+s(2.,0.)+s(0.,-2.))*.0625
    +(s(-1.,1.)+s(1.,1.)+s(-1.,-1.)+s(1.,-1.))*.125;
  o=vec4(r,1.);
}`;

export const UP_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel;
in vec2 vUv; out vec4 o;
vec3 s(float x,float y){ return texture(uSrc,vUv+vec2(x,y)*uTexel).rgb; }
void main(){
  vec3 r=(s(-1.,-1.)+s(1.,-1.)+s(-1.,1.)+s(1.,1.))+(s(0.,-1.)+s(0.,1.)+s(-1.,0.)+s(1.,0.))*2.+s(0.,0.)*4.;
  o=vec4(r/16.,1.);
}`;

export const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uDir;
in vec2 vUv; out vec4 o;
void main(){
  vec3 r=texture(uSrc,vUv).rgb*.2270;
  r+=(texture(uSrc,vUv+uDir*1.3846).rgb+texture(uSrc,vUv-uDir*1.3846).rgb)*.3162;
  r+=(texture(uSrc,vUv+uDir*3.2308).rgb+texture(uSrc,vUv-uDir*3.2308).rgb)*.0703;
  o=vec4(r,1.);
}`;

export const COMPOSITE_FS = `#version 300 es
precision highp float;
uniform sampler2D uScene, uBloom, uRefl;
uniform float uBloomK, uReflK, uFloorV, uTime, uHasRefl;
uniform vec2 uRes;
in vec2 vUv; out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
vec3 tone(vec3 c){ vec3 k=vec3(.7); vec3 over=max(c-k,0.); return min(c,k)+(1.-k)*(1.-exp(-over/(1.-k))); }
void main(){
  vec2 uv=vUv;
  vec3 c=texture(uScene,uv).rgb;
  if(uHasRefl>.5){
    float below=clamp((uFloorV-uv.y)*uRes.y*.25,0.,1.);
    float depth=max(uFloorV-uv.y,0.);
    float rip=sin(uv.y*uRes.y*.085+uTime*1.2)*.6+sin(uv.y*uRes.y*.027-uTime*.7)*.4;
    vec2 ruv=uv+vec2(rip*.004*min(depth*6.,1.),0.);
    c+=texture(uRefl,ruv).rgb*uReflK*below;
  }
  c+=texture(uBloom,uv).rgb*uBloomK;
  c=tone(c);
  vec2 d=(uv-.5)*vec2(uRes.x/uRes.y,1.);
  c*=mix(1.,smoothstep(1.3,.3,length(d)),.55);
  float g=hash(gl_FragCoord.xy+fract(uTime*7.13)*113.)-.5;
  c+=g*.03;
  o=vec4(max(c,0.),1.);
}`;
