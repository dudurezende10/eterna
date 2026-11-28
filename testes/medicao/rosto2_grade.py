import numpy as np
d = np.load("/tmp/aura/emb.npz"); SA, AA, FA, LA, SB, AB, LB = d["SA"], d["AA"], d["FA"], d["LA"], d["SB"], d["AB"], d["LB"]
S = SA @ SB.T; A = AA @ AB.T
mesmo = (S >= 0.5) & (A >= 0.5) | (A >= 0.6) | (S >= 0.65)
ka, kb = ~mesmo.any(1), ~mesmo.any(0)
kb &= LB >= 80          # busca = rosto grande, como uma selfie
print("buscas (rosto >= 80 px) %d, rostos do dia %d" % (kb.sum(), ka.sum()))
S, A = S[ka][:, kb], A[ka][:, kb]
SS = SA @ SA.T; AX = AA @ AA.T
tri = np.triu(np.ones(SS.shape, bool), 1) & (FA[:, None] != FA[None, :])
G = tri & ((SS >= 0.55) | (AX >= 0.55)); gs, ga = SS[G], AX[G]
print("pares 'mesma pessoa' (um dos dois >= 0.55): %d" % G.sum())
def linha(nome, m, g):
    c = m.sum(0); print("  %-40s estranho em %5.1f%% das buscas | %6.1f por 100 buscas | acha a mesma pessoa %5.1f%%" % (nome, 100 * (c > 0).mean(), 100 * c.mean(), 100 * g.mean()))
linha("hoje: SFace>=0.45", S >= 0.45, gs >= 0.45)
for t in (0.40, 0.42, 0.45, 0.48, 0.50): linha("Aura>=%.2f" % t, A >= t, ga >= t)
for ta, ts in ((0.40, 0.30), (0.40, 0.33), (0.42, 0.30), (0.42, 0.33), (0.45, 0.30), (0.38, 0.36), (0.36, 0.38)):
    linha("Aura>=%.2f e SFace>=%.2f" % (ta, ts), (A >= ta) & (S >= ts), (ga >= ta) & (gs >= ts))
for t in (0.80, 0.84, 0.88, 0.92): linha("Aura+SFace>=%.2f" % t, (A + S) >= t, (ga + gs) >= t)
for t in (0.84, 0.88): linha("soma>=%.2f e Aura>=0.36 e SFace>=0.30" % t, ((A + S) >= t) & (A >= 0.36) & (S >= 0.30), ((ga + gs) >= t) & (ga >= 0.36) & (gs >= 0.30))
print("Ronaldo de óculos: Aura 0.456 SFace 0.379 soma 0.835 | sem óculos: Aura 0.506 SFace 0.553 soma 1.059")
