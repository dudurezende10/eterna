# Escola pelo voucher (17/11): o agente lê os grupos do Viva Parceiros, fica só com os vouchers confirmados com [Escola] e,
# depois da janela da visita, monta a galeria `evento` com as sessões começadas na janela.
# Roda com HOME temporário:  python3 -I testes/escola_agente.py agente/eterna-agente.py
import importlib.util, json, os, sys, time

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _agente_sessao               # para aqui se o HOME não for temporário
sp = importlib.util.spec_from_file_location("ag", sys.argv[1])
m = importlib.util.module_from_spec(sp)
sp.loader.exec_module(m)
falhas = []


def ok(c, msg):
    if not c:
        falhas.append(msg)


DIA = "2026-11-12"
T = lambda hm: time.mktime(time.strptime(DIA + " " + hm, "%Y-%m-%d %H:%M"))
G = lambda loc, dsc, hora="09:15", status="confirmado", pessoas=50, inst="EE Thiago Delgado": {
    "id": loc, "instituicao": inst, "descricao": dsc, "visitaDia": DIA, "visitaHora": hora, "status": status, "pessoas": pessoas,
    "voucher": {"localizador": loc}}
grupos = [
    G("1112ABCD1234", "Voucher [EE THIAGO DELGADO] [12.11 09h15] [4 Inteiras + 46 Meias] [Escola]"),
    G("1112ABCD1234", "Voucher [EE THIAGO DELGADO] [12.11 09h15] [4 Inteiras + 46 Meias] [Escola]", hora="09:30", pessoas=10),
    G("1112CORP0001", "Voucher [EMPRESA X LTDA] [12.11 09h15] [30 Inteiras]", inst="Empresa X Ltda"),
    G("1112PEND0001", "Voucher [Colégio Y] [12.11 10h00] [40 Meias] [Escola]", status="reservado", inst="Colégio Y"),
]
vs = m.escola_vouchers(grupos)
ok(set(vs) == {"1112ABCD1234"}, "só voucher confirmado com [Escola]: %s" % sorted(vs))
v = vs.get("1112ABCD1234") or {}
ok(v.get("horarios") == ["09:15", "09:30"] and v.get("pessoas") == 60, "dois horários do mesmo voucher somam: %s" % v)

# sessões do dia: duas na janela (uma com base de IA), uma antes e uma bem depois
os.makedirs(m.SESS_DIR, exist_ok=True)
S = lambda card, hm, fotos, ia=(): {"card": card, "dia": DIA, "cap0": T(hm), "cap1": T(hm) + 600, "fotos": fotos, "ia": list(ia), "removida": False}
json.dump({"dia": DIA, "sessoes": [S("LPA", "09:20", ["aaa001", "aaa002"]), S("LPB", "11:30", ["bbb001", "bbb002"], ia=["bbb002"]),
                                    S("LPC", "08:30", ["ccc001"]), S("LPD", "12:30", ["ddd001"]), dict(S("LPE", "09:40", ["eee001"]), removida=True)]},
          open(os.path.join(m.SESS_DIR, DIA + ".json"), "w"))
# uma galeria de sessão publicada pelo app, de onde vêm os preços
tok0 = "A" * 22
m.REPO.salvar_manifesto(tok0, {"token": tok0, "tipo": "sessao", "criada": "2026-11-12T10:00:00Z", "precos": {"dig": 39, "todas": 250}, "catalogo": [], "fotos": []})

ok(m.escola_tick(grupos, agora=T("11:00")) == 0, "antes de acabar a janela não monta")
ok(m.escola_tick(grupos, agora=T("12:10")) == 1, "depois da janela monta a galeria")
reg = m.escola_ler().get("1112ABCD1234") or {}
gm = m.REPO.ler_manifesto(reg.get("token") or "x") or {}
ids = sorted(f["id"] for f in gm.get("fotos") or [])
ok(gm.get("tipo") == "evento" and gm.get("menor") is True and gm.get("nome") == "EE Thiago Delgado", "galeria evento de menor com o nome da escola: %s" % {k: gm.get(k) for k in ("tipo", "menor", "nome")})
ok(ids == ["ag_aaa001", "ag_aaa002", "ag_bbb001"], "só fotos das sessões da janela, sem base de IA nem sessão removida: %s" % ids)
ok((gm.get("voucher") or {}).get("localizador") == "1112ABCD1234" and gm["voucher"].get("pessoas") == 60, "bloco do voucher no manifesto: %s" % gm.get("voucher"))
ok(gm.get("precos") == {"dig": 39.0, "todas": 250.0} and m.codigos.get(gm.get("codigo")) == reg.get("token"), "preços da galeria publicada e código curto")
ok(m.escola_tick(grupos, agora=T("12:20")) == 0, "sem sessão nova, não republica")
# chegou uma sessão atrasada na janela: atualiza a mesma galeria
d = json.load(open(os.path.join(m.SESS_DIR, DIA + ".json")))
d["sessoes"].append(S("LPF", "10:00", ["fff001"]))
json.dump(d, open(os.path.join(m.SESS_DIR, DIA + ".json"), "w"))
ok(m.escola_tick(grupos, agora=T("13:00")) == 1, "sessão nova na janela atualiza")
reg2 = m.escola_ler().get("1112ABCD1234") or {}
ok(reg2.get("token") == reg.get("token") and "ag_fff001" in {f["id"] for f in m.REPO.ler_manifesto(reg2["token"])["fotos"]}, "mesma galeria, com a foto nova")
# visita antiga (fora dos 7 dias) não monta
ok(m.escola_tick(grupos, agora=T("12:10") + 9 * 86400) == 0, "voucher de mais de 7 dias fica de fora")
# o manifesto recusa voucher malformado
ok(m.escola_voucher_ok({"localizador": "x;drop", "dia": DIA}) is None, "localizador inválido recusado")

if falhas:
    print("FALHA escola_agente: " + " | ".join(falhas))
    sys.exit(1)
print("OK escola_agente: só [Escola] confirmado, janela da visita, sem IA, preços, atualização e prazo de 7 dias")
