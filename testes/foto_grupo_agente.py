"""Foto do grupo no Checkout (15/11): rostos do grupo e junção das fotos de cada pessoa."""
import importlib.util, sys
spec = importlib.util.spec_from_file_location("ag", sys.argv[1]); ag = importlib.util.module_from_spec(spec); spec.loader.exec_module(ag)
falhas = 0
def ok(c, m):
    global falhas
    print(("ok   " if c else "FALHA ") + m)
    falhas += 0 if c else 1
fs = [(200, "a"), (180, "b"), (150, "c"), (90, "d"), (40, "fundo")]
ok([x[1] for x in ag.grupo_rostos(fs)] == ["a", "b", "c", "d"], "rosto bem menor ao fundo não entra no grupo")
ok(ag.grupo_rostos([]) == [], "sem rosto: grupo vazio")
ok(len(ag.grupo_rostos([(100, str(i)) for i in range(12)])) == ag.GRUPO_MAX, "no máximo GRUPO_MAX pessoas")
r = ag.grupo_juntar([{"fotos": [{"id": "f1", "sim": .5, "principal": False}, {"id": "f2", "sim": .6, "principal": True}]},
                     {"fotos": [{"id": "f1", "sim": .7, "principal": True}, {"id": "f3", "sim": .41, "principal": False}]}])
d = {x["id"]: x for x in r}
ok(set(d) == {"f1", "f2", "f3"}, "fotos de todas as pessoas somadas")
ok(d["f1"]["sim"] == .7 and d["f1"]["principal"] is True, "foto do grupo junto: maior semelhança e principal de alguém")
ok([x["id"] for x in r] == ["f1", "f2", "f3"], "da mais parecida para a menos")
print("FALHAS:", falhas); sys.exit(1 if falhas else 0)
