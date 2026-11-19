import json,re,math
# Uso: python3 scripts/genera-manos-cancionero.py  (desde la raíz del repo)
# Lee los dibujos de la lámina y escribe src/manos-cancionero.js. Volver a correrlo
# si cambia public/mapa-de-manos.html.
import os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_lam = open(os.path.join(RAIZ, 'public', 'mapa-de-manos.html'), encoding='utf-8').read()
def _seccion(nombre):
    i = _lam.index(f'data-sec="{nombre}" data-modos')
    j = _lam.index('data-sec=', i + 20)
    return re.findall(r'<svg.*?</svg>', _lam[i:j], re.S)
d = {'forma': _seccion('forma'), 'mayores': _seccion('mayores'), 'menique': _seccion('menique')}
# La flecha de «pulgares arriba» quiere decir «una octava más alto» en el modo
# música; en el cancionero no significa nada (en cantar esa figura es el V): fuera.
FLECHA = '<path d="M150 34 L150 8 M139 19 L150 8 L161 19" stroke="#C44A1A" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
d['forma'] = [x.replace(FLECHA, '') for x in d['forma']]
ELRE=r'<(?:path|circle|line|polygon|polyline|rect|ellipse|text)[^>]*?/?>(?:[^<]*</text>)?'
def els(s): return re.findall(ELRE, s)
NUM=r'(-?[\d.]+)'
def capsula(e):
    m=re.search(r'd="M'+NUM+' '+NUM+'L'+NUM+' '+NUM+r'A[^"]*? '+NUM+' '+NUM+'L'+NUM+' '+NUM+'A',e)
    v=list(map(float,m.groups())); p1,p2,p3,p4=(v[0],v[1]),(v[2],v[3]),(v[4],v[5]),(v[6],v[7])
    a=((p1[0]+p4[0])/2,(p1[1]+p4[1])/2); b=((p2[0]+p3[0])/2,(p2[1]+p3[1])/2)
    return a,b
def doblados(lista):
    return [i for i,e in enumerate(lista) if 'fill="#F1D7B8"' in e and 'A8.4 8.4' in e]
def grupo_doblado(lista, ifill):
    """los 4 elementos del dedo doblado: sombra, contorno, relleno (mismo d) y el pliegue más cercano"""
    dd=re.search(r'd="([^"]*)"',lista[ifill]).group(1)
    idx=[i for i,e in enumerate(lista) if ('d="'+dd+'"') in e]
    a,b=capsula(lista[ifill]); c=((a[0]+b[0])/2,(a[1]+b[1])/2)
    best=None
    for i,e in enumerate(lista):
        if e.startswith('<line') and 'stroke-opacity="0.35"' in e:
            x1,y1,x2,y2=[float(re.search(k+r'="(-?[\d.]+)"',e).group(1)) for k in ('x1','y1','x2','y2')]
            dist=math.hypot((x1+x2)/2-c[0],(y1+y2)/2-c[1])
            if dist<12 and (best is None or dist<best[0]): best=(dist,i)
    if best: idx.append(best[1])
    return idx
base=els(d['forma'][0])
B=doblados(base)  # [Lmayor, Lanular, Lmeñique, Rmayor, Ranular, Rmeñique]
def extendido(variante, dedo_ifill):
    """elementos que agrega la variante respecto del rectángulo, cerca del dedo dado"""
    v=els(d[variante[0]][variante[1]])
    a,b=capsula(base[dedo_ifill]); c=((a[0]+b[0])/2,(a[1]+b[1])/2)
    add=[e for e in v if e not in base]
    def cerca(e):
        nums=list(map(float,re.findall(r'(?:d="M|cx="|x1=")(-?[\d.]+)',e)))
        return nums and abs(nums[0]-c[0])<45
    return [e for e in add if cerca(e)]
EXT={ 'Rmen': extendido(('menique',1),B[5]), 'Rmay': extendido(('mayores',1),B[3]), 'Lmay': [e for e in extendido(('mayores',2),B[0])] }
for k,v in EXT.items(): print(k,len(v))
def transf(ib, forma_lista, ishape):
    a0,b0=capsula(base[ib]); a1,b1=capsula(forma_lista[ishape])
    ang0=math.atan2(b0[1]-a0[1],b0[0]-a0[0]); ang1=math.atan2(b1[1]-a1[1],b1[0]-a1[0])
    t=ang1-ang0; s=math.hypot(b1[0]-a1[0],b1[1]-a1[1])/max(1e-6,math.hypot(b0[0]-a0[0],b0[1]-a0[1]))
    s=max(.85,min(1.15,s))
    c0=((a0[0]+b0[0])/2,(a0[1]+b0[1])/2); c1=((a1[0]+b1[0])/2,(a1[1]+b1[1])/2)
    ca,sa=math.cos(t)*s,math.sin(t)*s
    e=c1[0]-(ca*c0[0]-sa*c0[1]); f=c1[1]-(sa*c0[0]+ca*c0[1])
    return f'matrix({ca:.4f} {sa:.4f} {-sa:.4f} {ca:.4f} {e:.2f} {f:.2f})'
GR=['rectangulo','trapecio_piso','trapecio_techo','trapecio_izq','trapecio_der','la','si','do_alto']
out={}
for gi,g in enumerate(GR):
    svg=d['forma'][gi]; lista=els(svg); D=doblados(lista)
    for comp in (0,1,2):
        for men in (False,True):
            cambios=[]  # (dedo ordinal, clave EXT)
            if comp>=1: cambios.append((3,'Rmay'))
            if comp>=2: cambios.append((0,'Lmay'))
            if men: cambios.append((5,'Rmen'))
            nueva=list(lista); quitar=set(); agregar={}
            for orden,clave in cambios:
                idx=grupo_doblado(lista,D[orden]); quitar|=set(idx)
                g_=f'<g transform="{transf(B[orden],lista,D[orden])}">'+''.join(EXT[clave])+'</g>'
                agregar[min(idx)]=agregar.get(min(idx),'')+g_
            cuerpo=''.join((agregar.get(i,'')+('' if i in quitar else e)) for i,e in enumerate(lista))
            cab=re.match(r'<svg[^>]*>',svg).group(0).replace('width="100%" height="236"','class="mano"',1)
            out[f'{g}|{comp}|{int(men)}']=cab+cuerpo+'</svg>'
js=["// GENERADO — no editar a mano. Dibujos de las manos para el cancionero, sacados",
"// de la lámina del «?» (public/mapa-de-manos.html). Las variantes con dedos mayores",
"// y meñique arriba cambian el dedo doblado por el estirado de la lámina, girado según",
"// la mano de cada figura. Clave: 'figura|mayores|meñique' (figura = la de hands.js).",
"export const MANOS = {"]
for k,v in out.items(): js.append(f"  {json.dumps(k)}: {json.dumps(v)},")
js.append("};")
open(os.path.join(RAIZ, 'src', 'manos-cancionero.js'),'w', encoding='utf-8').write('\n'.join(js)+'\n')
print(len(out), 'dibujos')
