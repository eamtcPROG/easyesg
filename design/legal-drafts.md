# EasyESG — legal documents, first draft

**Status: DRAFT. Not for publication until a Moldovan lawyer has reviewed it.**

**It lives in `design/` beside the prototype it was drafted against** (`design/screens/EasyESG Public Legal.dc.html`), and that is a shelf rather than a decision — where the *shipped* legal text lives is task 75.1's first unknown, still open, and item 13 below. It is deliberately not in `docs/`, which holds the seven specification documents and the two tracking files and gains no eighth.

Drafted 10 September 2026 against the codebase at commit `a9e6a46`, not against the design
prototype — see "What changed from the prototype" below, which is the reason this draft exists in
this form.

**Governing instruments.** Law No. 195/2024 on personal data protection (Republic of Moldova),
published 23 August 2024, **in force 23 August 2026**, repealing Law No. 133/2011. It substantially
transposes Regulation (EU) 2016/679 (GDPR). Supervisory authority: the National Centre for Personal
Data Protection (NCPDP). Administrative fines phase in — up to 10% of the calculated fine until
22 August 2027, 40% to 22 August 2028, 100% thereafter.

**Romanian is the binding version** (design_spec §4.4, S-30; the prototype states this on the page
itself). English follows it here for review convenience. **Russian is not drafted** — the repository
rule is that all three locales are separately authored and never machine-translated, so a Russian
version needs a Russian-speaking author, not a translation of these.

---

## What changed from the prototype, and why

`design/screens/EasyESG Public Legal.dc.html` carries placeholder copy drawn 18 August 2026, before
the authentication work landed. Every factual claim below was re-established from source. This is
task 75's third recorded unknown — *"what the application actually sets"* — answered.

| Prototype claim | Established from source | Where |
| --- | --- | --- |
| Cookies `esg_session`, `esg_csrf`, `esg_lang`, `esg_consent`, `esg_stats` | `easyesg_session`, `NEXT_LOCALE`, `easyesg_social`, `easyesg_factor_challenge`, `easyesg_pending_link` | `apps/web/src/lib/session-cookie.ts`, `server/factor-challenge.ts`, `server/pending-link.ts` |
| An optional analytics cookie counting page visits | No analytics of any kind exists | no tracking code in `apps/web`, `apps/admin`, `packages/ui` |
| Public pages load two fonts from a font service | Fonts are self-hosted; no external request | `apps/web/src/app/globals.css` |
| Draft cache in `localStorage` as `esg_draft_cache` | IndexedDB, keyed by account id | `apps/web/src/client/autosave/pending-store.ts` |
| An `esg_csrf` cookie stops cross-site submission | Same-origin proof on writes; no CSRF cookie | `apps/web/src/app/api/[...path]/route.ts` |
| "Under Law 133/2011" | Law 195/2024 replaces it from 23 Aug 2026 | NFR-5 |
| Hosting in Frankfurt, DE | EU region; named regions are illustrative, provider not committed | architecture.md §15 |
| Payment provider in Chișinău holds card data | Four rails behind one adapter, none activated | D-7, D-8 |
| Retention table: 30 days / 12 months / 5 years / 90 days / 24 months | Not in the register; NFR-6's retention period is explicitly unquantified | NFR-6 |

**Consequence for the cookie banner.** All five cookies are strictly necessary to deliver a service
the user asked for. Under Law 195/2024 and the ePrivacy standard it aligns with, strictly necessary
cookies require **information, not consent**. So no consent banner is legally required as the
product stands, and S-31's cookie choice has nothing to offer a choice about. **OQ-23 (raised for it on 10 Sep 2026, since OQ-16 is a different question) is closed
on that basis, or the analytics the prototype assumed should be built** — but the two cannot
both be left open, because the cookie policy has to say one or the other.

---

# 1. Cookie policy

The only one of the three drafted with complete confidence: every claim is checkable against the
code, and there are no open business decisions inside it.

## 1.1 Romanian (binding)

### Politica privind modulele cookie

**În vigoare de la:** [DATA] · **Versiunea:** 1.0

#### Pe scurt

Folosim cinci module cookie. Toate cinci sunt necesare pentru ca serviciul să funcționeze — vă
autentifică, vă păstrează limba și vă protejează contul. **Nu folosim niciun modul cookie de
statistică, de publicitate sau de urmărire**, nici al nostru, nici al altcuiva. Din acest motiv nu
vă cerem un acord: nu există nimic de acceptat sau de refuzat.

#### Ce este un modul cookie

Un fișier mic pe care site-ul îl păstrează în browserul dumneavoastră ca să vă recunoască la
următoarea cerere. Fără el, fiecare pagină ar porni de la zero și nu ați putea rămâne autentificat.

#### Modulele cookie pe care le folosim

Toate cinci sunt stabilite de `easyesg.md` și de nimeni altcineva. Niciunul nu este transmis altei
companii.

| Numele | La ce servește | Cât durează |
| --- | --- | --- |
| `easyesg_session` | Vă menține autentificat între ecrane. Conține sesiunea dumneavoastră în formă criptată; browserul nu o poate citi. | Până la deconectare, sau după 7 zile de inactivitate, ori 30 de zile în total |
| `NEXT_LOCALE` | Reține dacă citiți site-ul în română, rusă sau engleză. | 12 luni |
| `easyesg_social` | Păstrează, pentru câteva minute, datele necesare autentificării printr-un furnizor extern (Google, Microsoft). Se șterge imediat după. | Câteva minute |
| `easyesg_factor_challenge` | Păstrează pasul de verificare în doi pași între introducerea parolei și introducerea codului. | 5 minute |
| `easyesg_pending_link` | Reține că ați început legarea unui cont extern de contul dumneavoastră, ca să putem cere confirmarea. | Câteva minute |

#### Ce nu folosim

- Module cookie de statistică sau de analiză a traficului.
- Module cookie de publicitate sau de reconstituire a profilului.
- Module cookie stabilite de altă companie (terță parte).
- Pixeli de urmărire, amprentare a browserului sau rețele de publicitate.
- Resurse încărcate de pe alte servere: fonturile sunt găzduite de noi, nu de un serviciu extern.

#### Stocare care nu este un modul cookie

Cât timp completați un raport, browserul păstrează local o copie a răspunsurilor, ca o conexiune
pierdută să nu vă piardă munca. Este păstrată în **IndexedDB**, în browserul dumneavoastră, sub o
cheie legată de contul cu care sunteți autentificat. Nu pleacă singură de pe dispozitiv; se trimite
la serverele noastre doar ca parte a salvării raportului, și se golește la deconectare.

Aceasta face parte din funcționarea serviciului, deci nu poate fi dezactivată separat.

#### De ce nu vă cerem acordul

Legea cere acordul pentru modulele cookie care nu sunt strict necesare — cele de statistică, de
publicitate sau de urmărire. Noi nu folosim niciunul. Cele cinci de mai sus sunt strict necesare
pentru un serviciu pe care dumneavoastră l-ați cerut, așa că legea ne cere să vă **informăm**, nu să
vă cerem permisiunea. Dacă vom adăuga vreodată un modul cookie care nu este strict necesar, vom cere
acordul înainte de a-l folosi și vom actualiza această pagină.

#### Cum le ștergeți

Le puteți șterge oricând din setările browserului. Dacă ștergeți `easyesg_session`, veți fi
deconectat. Dacă blocați toate modulele cookie pentru `easyesg.md`, nu vă veți putea autentifica.

#### Întrebări

[legal@easyesg.md]

## 1.2 English

### Cookie policy

**In force from:** [DATE] · **Version:** 1.0

#### In short

We set five cookies. All five are needed for the service to work — they sign you in, remember your
language and protect your account. **We set no statistics, advertising or tracking cookies**, ours
or anyone else's. That is why we do not ask you to agree to anything: there is nothing to accept or
refuse.

#### The cookies we set

All five are set by `easyesg.md` and by nobody else. None is shared with another company.

| Name | What it is for | How long |
| --- | --- | --- |
| `easyesg_session` | Keeps you signed in as you move between screens. It holds your session in encrypted form; your browser cannot read it. | Until you sign out, or after 7 days idle, or 30 days in total |
| `NEXT_LOCALE` | Remembers whether you read the site in Romanian, Russian or English. | 12 months |
| `easyesg_social` | Holds, for a few minutes, what is needed to sign in through an outside provider (Google, Microsoft). Deleted immediately afterwards. | A few minutes |
| `easyesg_factor_challenge` | Holds the two-step verification between your password and your code. | 5 minutes |
| `easyesg_pending_link` | Remembers that you began linking an outside account, so we can ask you to confirm. | A few minutes |

#### What we do not set

- Statistics or traffic-analysis cookies.
- Advertising or profiling cookies.
- Cookies set by another company.
- Tracking pixels, browser fingerprinting or ad networks.
- Resources loaded from other servers: our fonts are hosted by us, not by a font service.

#### Storage that is not a cookie

While you fill in a report, your browser keeps a local copy of your answers so a lost connection
does not lose your work. It sits in **IndexedDB**, in your browser, under a key tied to the account
you are signed in as. It never leaves your device on its own; it is sent to our servers only as part
of saving the report, and it is cleared when you sign out.

This is part of the service working as intended, so it cannot be switched off separately.

#### Why we do not ask for your consent

The law requires consent for cookies that are not strictly necessary — statistics, advertising,
tracking. We use none of those. The five above are strictly necessary for a service you asked for,
so the law requires us to **tell you**, not to ask permission. If we ever add a cookie that is not
strictly necessary, we will ask before setting it and update this page.

#### Deleting them

You can delete them at any time in your browser settings. Deleting `easyesg_session` signs you out.
Blocking all cookies for `easyesg.md` means you cannot sign in.

#### Questions

[legal@easyesg.md]

---

# 2. Privacy notice

**Everything in square brackets is a business or legal decision that is not in the codebase and
must not be invented.** They are listed again in section 4.

## 2.1 Romanian (binding)

### Notă de confidențialitate

**Ultima actualizare:** [DATA] · **Versiunea:** 1.0

#### Cine răspunde pentru ce

Două relații diferite se desfășoară în paralel, și contează sub care dintre ele intră o întrebare.

**Noi suntem operatorul** pentru contul dumneavoastră și pentru relația companiei dumneavoastră cu
noi: nume, adresă de e-mail de serviciu, rol, înregistrările de autentificare, facturile, mesajele
către asistență.

**Dumneavoastră sunteți operatorul** pentru datele cu caracter personal din interiorul raportului —
numărul de angajați, evidența accidentelor de muncă, raporturile de salarizare. Noi le prelucrăm
doar la instrucțiunea dumneavoastră, în temeiul acordului de prelucrare a datelor.

Persoana de contact pentru protecția datelor: [privacy@easyesg.md].
[DE DECIS: dacă legea impune un responsabil cu protecția datelor pentru volumul dumneavoastră de
prelucrare — art. privind desemnarea DPO din Legea 195/2024 — și cine este acesta.]

#### Ce păstrăm și de ce

| Ce | De ce | Temeiul |
| --- | --- | --- |
| Nume, e-mail de serviciu, limbă preferată | Ca să vă putem oferi un cont și nivelul corect de acces | Contract |
| Parola, sub formă de amprentă criptografică | Ca să vă putem autentifica. Nu păstrăm niciodată parola în clar și nu o putem citi | Contract |
| Identificatorul contului extern (Google, Microsoft), dacă îl folosiți | Ca să vă putem recunoaște la autentificare. Vă potrivim după identificatorul furnizorului, niciodată după adresa de e-mail | Contract |
| Datele companiei, IDNO | Ca să identificăm entitatea raportoare și să emitem facturi | Contract, obligație legală |
| Răspunsurile din raport și documentele încărcate | Ca să vă salvăm munca, să calculăm cifrele și să producem documentele | Instrucțiunea dumneavoastră (noi suntem persoană împuternicită) |
| Autentificări, adresa IP, încercările eșuate | Ca să păstrăm conturile în siguranță și să oprim atacurile prin încercări repetate | Interes legitim |
| Istoricul modificărilor pe fiecare câmp: cine, ce, când | Ca raportul să poată fi auditat și ca o cifră să poată fi explicată | Interes legitim, și cerință a standardului |
| Facturi și evidențe de plată | Ca să încasăm plata și să ținem contabilitatea | Obligație legală |

**Nu vindem datele dumneavoastră, nu le folosim pentru publicitate și nu le folosim pentru
antrenarea unor modele.**

#### Cine altcineva le atinge

[DE COMPLETAT — lista subîmputerniciților, cu numele real al fiecărei companii, ce face și unde se
află. Documentele arhitecturale angajează regiunea (UE/SEE) și nu furnizorul; regiunile numite acolo
sunt orientative. Lista nu poate fi scrisă până când furnizorii nu sunt aleși, și este exact lista
pe care o autoritate de supraveghere o verifică prima.]

Nu adăugăm un subîmputernicit nou fără să actualizăm această listă în prealabil.

#### Unde sunt păstrate

Toate datele sunt păstrate în Uniunea Europeană sau în Spațiul Economic European — baza de date
principală, copiile de rezervă, exporturile generate și jurnalele. Nu ne bazăm pe o decizie de
adecvare și nici pe clauze contractuale standard ca să le ținem acolo: pur și simplu nu le scoatem.

#### Cât timp le păstrăm

| Datele | Păstrate |
| --- | --- |
| Jurnalele de audit, registrele contabile și evidența consumului | 6 ani |
| Facturile și evidențele de plată | [DE DECIS — termenul din legislația fiscală a Republicii Moldova] |
| Ciornele și rapoartele finalizate | [DE DECIS] |
| Datele contului după închiderea acestuia | [DE DECIS] |
| Jurnalele de autentificare și de securitate | [DE DECIS] |
| Mesajele către asistență | [DE DECIS] |

[Registrul cerințelor nefuncționale lasă termenele de păstrare nedeterminate în mod explicit —
NFR-6. Sunt o decizie de afaceri, nu una tehnică, și nu pot fi deduse din cod.]

#### Cum le păstrăm în siguranță

- Datele fiecărei organizații sunt izolate în baza de date însăși, nu doar în aplicație.
- Parolele sunt păstrate cu Argon2id. Secretele care trebuie recuperate sunt criptate AES-256-GCM.
- Sesiunile expiră după 7 zile de inactivitate și după 30 de zile în total, iar un jeton de
  reîmprospătare refolosit anulează întreaga sesiune.
- Istoricul modificărilor nu poate fi șters sau modificat de aplicație — nici măcar de un
  administrator.
- Autentificarea în doi pași este disponibilă pentru orice cont.

#### Drepturile dumneavoastră

În temeiul **Legii nr. 195/2024** privind protecția datelor cu caracter personal, și al GDPR acolo
unde vi se aplică, ne puteți cere:

- să vă arătăm ce date deținem despre dumneavoastră;
- să corectăm o informație greșită;
- să ștergem ce nu ne mai este necesar;
- să vă trimitem o copie într-un format care poate fi citit automat;
- să restrângem o anumită utilizare;
- să vă opuneți unei prelucrări întemeiate pe interesul legitim;
- să retrageți un acord pe care l-ați dat.

Scrieți-ne la [privacy@easyesg.md]. Răspundem în termen de 30 de zile.

Dacă datele se află **într-un raport**, operatorul este compania care a întocmit raportul, nu noi —
vă vom îndruma către ea.

#### Încălcări de securitate

Dacă are loc o încălcare a securității datelor care prezintă un risc pentru drepturile
dumneavoastră, anunțăm Centrul Național pentru Protecția Datelor cu Caracter Personal în cel mult
**72 de ore** de la momentul în care am aflat, și vă anunțăm și pe dumneavoastră dacă riscul este
ridicat.

#### Plângeri

Ne puteți scrie mai întâi nouă. Aveți însă dreptul să vă adresați direct autorității:

**Centrul Naţional pentru Protecţia Datelor cu Caracter Personal**
[adresa și datele de contact — de verificat pe datepersonale.md la data publicării]

## 2.2 English

### Privacy notice

**Last updated:** [DATE] · **Version:** 1.0

#### Who is responsible for what

Two different relationships run in parallel, and it matters which one a question falls under.

**We are the controller** for your account and your company's relationship with us: name, work
email, role, sign-in records, invoices, support messages.

**You are the controller** for personal data inside your report — headcount, accident records, pay
ratios. We only process it on your instructions, under the data processing agreement.

Our data protection contact is [privacy@easyesg.md]. [TO DECIDE: whether Law 195/2024 requires you
to appoint a data protection officer at your processing volume, and who that is.]

#### What we hold, and why

| What | Why | Basis |
| --- | --- | --- |
| Name, work email, preferred language | To give you an account and the right level of access | Contract |
| Your password, as a cryptographic hash | To sign you in. We never store the password itself and cannot read it | Contract |
| Your outside-account identifier (Google, Microsoft), if you use one | To recognise you at sign-in. We match on the provider's identifier, never on the email address | Contract |
| Company details, IDNO | To identify the reporting entity and issue invoices | Contract, legal obligation |
| Report answers and uploads | To save your work, calculate figures and produce documents | Your instruction (we are the processor) |
| Sign-ins, IP address, failed attempts | To keep accounts secure and stop repeated-guess attacks | Legitimate interest |
| Per-field change history: who, what, when | So the report can be audited and a figure can be explained | Legitimate interest, and a requirement of the standard |
| Invoices and payment records | To take payment and keep the accounts | Legal obligation |

**We do not sell your data, use it for advertising, or use it to train models.**

#### Who else touches it

[TO COMPLETE — the sub-processor list, each company named, what it does and where it sits. The
architecture commits the region (EU/EEA) and not the provider; the regions named there are
illustrative. This cannot be written until suppliers are chosen, and it is exactly the list a
supervisory authority checks first.]

We do not add a new sub-processor without updating this list first.

#### Where it is stored

All data is held in the European Union or the European Economic Area — the primary database,
backups, generated exports and logs. We do not rely on an adequacy decision or on standard
contractual clauses to keep it there: we simply do not move it out.

#### How long we keep it

| Data | Kept for |
| --- | --- |
| Audit logs, ledgers and metering records | 6 years |
| Invoices and payment records | [TO DECIDE — the period Moldovan fiscal law requires] |
| Drafts and finished reports | [TO DECIDE] |
| Account data after you close the account | [TO DECIDE] |
| Sign-in and security logs | [TO DECIDE] |
| Support messages | [TO DECIDE] |

[The non-functional register leaves retention periods explicitly unquantified — NFR-6. They are a
business decision, not a technical one, and cannot be derived from the code.]

#### How we keep it safe

- Each organisation's data is isolated in the database itself, not only in the application.
- Passwords are stored with Argon2id. Secrets that must be recoverable are encrypted AES-256-GCM.
- Sessions expire after 7 days idle and 30 days absolute, and a reused refresh token revokes the
  whole session.
- Change history cannot be deleted or altered by the application — not even by an administrator.
- Two-step sign-in is available on any account.

#### Your rights

Under **Law No. 195/2024** on personal data protection, and under the GDPR where it applies to you,
you can ask us to show you what we hold, correct something wrong, delete what we no longer need,
send you a machine-readable copy, restrict a particular use, object to processing based on
legitimate interest, or withdraw a consent you gave.

Write to [privacy@easyesg.md]. We answer within 30 days.

If the data is **inside a report**, the controller is the company that prepared the report, not us —
we will point you to them.

#### Security breaches

If a data breach occurs that presents a risk to your rights, we notify the National Centre for
Personal Data Protection within **72 hours** of becoming aware of it, and we tell you as well where
the risk is high.

#### Complaints

Write to us first if you like. You have the right to go straight to the authority:

**National Centre for Personal Data Protection**
[address and contact details — verify on datepersonale.md at publication]

---

# 3. Terms of service

Follows the prototype's ten sections, because the structure is sound even where the copy was not.
The commercial clauses — price, service level, liability cap — are business decisions and are marked
rather than drafted; a liability cap in particular should be set by your lawyer, not by me.

## 3.1 Romanian (binding)

### Termeni și condiții

**În vigoare de la:** [DATA] · **Versiunea:** 1.0
**Versiunea în limba română este cea care obligă.** Traducerile în engleză și rusă sunt oferite
pentru înțelegere; în caz de neconcordanță, textul român prevalează.

#### 1. Cine suntem

EasyESG SRL, societate înregistrată în Republica Moldova, IDNO [DE CONFIRMAT], cu sediul în
[ADRESA], Chișinău. Ne puteți scrie la [legal@easyesg.md]; pentru asistență, [ajutor@easyesg.md].

#### 2. Ce face serviciul, și ce nu face

**Ce facem:**

- Vă găzduim răspunsurile și le păstrăm salvate.
- Transformăm facturile și unitățile de măsură în cifre de emisii (domeniul 1 și domeniul 2,
  metoda bazată pe localizare).
- Generăm fișierul raportului și exportul de date în formatul oficial.
- Ținem evidența cine ce a modificat.

**Ce nu facem:**

- **Nu verificăm dacă cifrele dumneavoastră sunt adevărate.** Datele pe care le introduceți sunt
  ale dumneavoastră și răspunderea pentru corectitudinea lor este a dumneavoastră.
- **Nu depunem, nu înregistrăm și nu publicăm nimic în numele dumneavoastră.**
- **Nu oferim consultanță juridică, fiscală sau de sustenabilitate.** Ce vedeți pe ecran este
  standardul, nu sfatul nostru.
- **Nu garantăm că o bancă, un cumpărător sau o autoritate acceptă rezultatul.**

Serviciul urmează standardul voluntar VSME publicat de EFRAG. Când standardul se schimbă, rapoartele
deja începute rămân legate de versiunea sub care au fost începute.

#### 3. Contul dumneavoastră și persoanele pe care le invitați

Vă creați un cont pe adresa dumneavoastră de e-mail de serviciu și sunteți răspunzător pentru ce se
întâmplă sub acesta. Nu împărțiți parola; invitați în schimb un coleg, care primește propriul cont.

Într-o organizație există trei roluri: **administrator**, care poate invita, poate schimba rolurile
și poate închide perioade; **editor**, care poate completa rapoarte; **cititor**, care poate doar
citi. O organizație trebuie să aibă în orice moment cel puțin un administrator — sistemul refuză
retrogradarea sau eliminarea ultimului.

#### 4. Conținutul raportului rămâne al dumneavoastră

Ce introduceți vă aparține. Îl puteți exporta oricând. **Nu îl folosim ca să antrenăm nimic și nu îl
arătăm nimănui pe care nu l-ați numit dumneavoastră.** Îl prelucrăm doar cât să facem serviciul să
funcționeze pentru dumneavoastră.

Nota de confidențialitate și acordul de prelucrare a datelor descriu în detaliu cum este tratat
conținutul; unde acestea intră în contradicție cu prezenta clauză, ele prevalează.

Ne acordați dreptul limitat de a stoca și prelucra conținutul strict în scopul furnizării
serviciului. Acest drept încetează când vă ștergeți conținutul sau contul.

#### 5. Planuri, plată și facturi

[DE COMPLETAT — planurile, prețurile, moneda, TVA, ciclul de facturare, reînnoirea automată și
dreptul de reziliere. Nimic din acestea nu există încă în produs.]

Facturile sunt emise conform legislației fiscale a Republicii Moldova și, de la **1 octombrie 2026**,
transmise prin sistemul e-Factura acolo unde legea o cere. O factură emisă nu se modifică; o
corecție se face printr-o notă de credit.

#### 6. Dacă nu mai plătiți sau plecați

[DE DECIS — termenele de mai jos sunt cele desenate în prototip și nu sunt încă o decizie. Fiecare
este o alegere comercială.]

| Când | Ce se întâmplă |
| --- | --- |
| Plata eșuează | [Serviciul continuă X zile; vă arătăm suma, data și acțiunea care rezolvă] |
| După aceea | [Rapoartele devin doar-citire: puteți citi, exporta și descărca, dar nu edita] |
| Închideți contul | [Păstrăm datele Y zile în caz de greșeală, apoi le ștergem; puteți cere ștergerea imediată] |
| După Z luni | [Un cont neplătit și conținutul său se șterg; scriem administratorului cu 30 de zile înainte] |

Puteți să vă exportați datele în orice moment cât timp contul este deschis, inclusiv în perioada
doar-citire.

#### 7. Disponibilitate și asistență

Ne străduim să menținem serviciul disponibil, dar nu îl oferim fără întreruperi. Facem întreținere
planificată și vă anunțăm din timp când aceasta afectează serviciul.

[DE DECIS — dacă oferiți un nivel de serviciu garantat, procentul și compensația. Perioada de vârf
este aprilie–mai, fereastra legală de depunere, și un incident acolo costă altceva decât în august.]

#### 8. De ce răspundem

Răspundem pentru furnizarea serviciului așa cum este descris aici. Nu răspundem pentru
corectitudinea datelor pe care le introduceți, pentru deciziile luate pe baza raportului, ori pentru
acceptarea sau respingerea raportului de către un terț.

[DE DECIS ÎMPREUNĂ CU AVOCATUL — plafonul de răspundere, excluderea daunelor indirecte și
interacțiunea cu legislația privind protecția consumatorului acolo unde clientul este o
microîntreprindere. Nu redactez o limitare de răspundere.]

#### 9. Modificarea acestor termeni

Vă anunțăm cu cel puțin [30] de zile înainte de o modificare care contează, prin e-mail către
administratorii organizației și printr-o notificare în aplicație. Dacă nu sunteți de acord, puteți
rezilia înainte ca modificarea să intre în vigoare. Păstrăm versiunile anterioare accesibile.

#### 10. Legea aplicabilă și litigiile

Acestor termeni li se aplică legea Republicii Moldova. [DE DECIS ÎMPREUNĂ CU AVOCATUL — instanța
competentă, și dacă se prevede o etapă de mediere.]

## 3.2 English

### Terms of service

**In force from:** [DATE] · **Version:** 1.0
**The Romanian version is the binding one.** English and Russian are provided for understanding;
where they differ, the Romanian text prevails.

#### 1. Who we are

EasyESG SRL, a company registered in the Republic of Moldova, IDNO [TO CONFIRM], registered office
at [ADDRESS], Chișinău. Write to us at [legal@easyesg.md]; for help, [ajutor@easyesg.md].

#### 2. What the service does, and what it does not do

**We do:** host your answers and keep them saved; convert bills and units into emissions figures
(Scope 1 and location-based Scope 2); generate the report file and its data export in the official
format; keep a record of who changed what.

**We do not:**

- **Check that your figures are true.** What you enter is yours, and so is responsibility for it.
- **File, register or publish anything for you.**
- **Give legal, tax or sustainability advice.** What you see on screen is the standard, not our
  advice.
- **Guarantee that a bank, a buyer or an authority accepts the result.**

The service follows the voluntary VSME standard published by EFRAG. When the standard changes,
reports already begun stay pinned to the version they were begun under.

#### 3. Your account and the people you invite

You create an account on your work email address and you are responsible for what happens under it.
Do not share your password; invite a colleague instead, and they get their own account.

An organisation has three roles: **administrator**, who can invite, change roles and lock periods;
**editor**, who can fill in reports; **viewer**, who can only read. An organisation must have at
least one administrator at all times — the system refuses to demote or remove the last one.

#### 4. Your report content stays yours

What you type is yours. You can export it at any time. **We do not use it to train anything, and we
do not show it to anyone you have not named.** We process it only as far as is needed to make the
service work for you.

The privacy notice and the data processing agreement say in detail how content is handled; where
they conflict with this clause, they win.

You grant us a limited right to store and process your content solely to provide the service. That
right ends when you delete the content or the account.

#### 5. Plans, payment and invoices

[TO COMPLETE — plans, prices, currency, VAT, billing cycle, automatic renewal and the right to
cancel. None of this exists in the product yet.]

Invoices are issued under Moldovan fiscal law and, from **1 October 2026**, transmitted through the
e-Factura system where the law requires it. An issued invoice is never edited; a correction is made
by credit note.

#### 6. If you stop paying or leave

[TO DECIDE — the periods below are the prototype's drawing, not a decision. Each is a commercial
choice.]

| When | What happens |
| --- | --- |
| Payment fails | [Everything keeps working for X days; we show the amount, the date and the one action that settles it] |
| After that | [Reports become read-only: you can read, export and download, but not edit] |
| You close the account | [We keep the data Y days in case it was a mistake, then delete it; you can ask for immediate deletion] |
| After Z months | [An unpaid account and its content are deleted. We write to the administrator 30 days before] |

You can export your data at any time while the account is open, including during any read-only
period.

#### 7. Availability and support

We work to keep the service available, but we do not offer it uninterrupted. We carry out planned
maintenance and tell you in advance when it will affect the service.

[TO DECIDE — whether you offer a guaranteed service level, the percentage and the remedy. Peak
season is April–May, the statutory filing window, and an incident there costs something different
from one in August.]

#### 8. What we are responsible for

We are responsible for providing the service as described here. We are not responsible for the
accuracy of the data you enter, for decisions taken on the basis of the report, or for a third
party accepting or rejecting it.

[TO DECIDE WITH YOUR LAWYER — the liability cap, the exclusion of indirect damages, and how this
interacts with consumer-protection law where the customer is a micro-enterprise. I am not drafting
a limitation of liability.]

#### 9. Changes to these terms

We tell you at least [30] days before a change that matters, by email to the organisation's
administrators and by a notice in the application. If you do not agree, you may terminate before it
takes effect. We keep previous versions available.

#### 10. Law and disputes

These terms are governed by the law of the Republic of Moldova. [TO DECIDE WITH YOUR LAWYER — the
competent court, and whether a mediation step applies.]

---

# 4. What must be decided before any of this is published

Grouped by who can answer. **None of these is derivable from the codebase**, which is why they are
marked rather than filled in.

## For your lawyer

1. **Liability cap and exclusions** (Terms §8). Also whether Moldovan consumer-protection law reaches
   a micro-enterprise customer, which changes what may be excluded.
2. **Competent court and any mediation step** (Terms §10).
3. **Whether Law 195/2024 requires you to appoint a data protection officer** at your processing
   volume, and if so who.
4. **Fiscal retention period** for invoices and payment records under Moldovan law.
5. **Whether the controller/processor split as drafted is right** — you as processor for report
   content, the customer as controller. This is the clause the whole data processing agreement
   hangs off, and it is the one most worth a second opinion.
6. **A data processing agreement and a sub-processor list**, which the prototype has as two further
   documents and which are not drafted here.

## For you, commercially

7. **Retention periods** — every `[TO DECIDE]` in the privacy notice's table. NFR-6 leaves these
   explicitly unquantified.
8. **The non-payment ladder** — the days and months in Terms §6.
9. **Plans, prices, VAT treatment, renewal and cancellation** (Terms §5).
10. **Whether you offer a service level** (Terms §7), given the April–May peak.
11. **The sub-processor list** — hosting, email, payments, error monitoring. The architecture commits
    the EU/EEA region and deliberately not the provider.
12. **IDNO, registered address and the three email addresses.** The prototype's `0310417` is
    placeholder and must be confirmed.

## For the repository — task 75's other two unknowns

13. **Where the legal text lives.** FR-61 as narrowed by OQ-43 covers help-centre articles and plan
    copy, and explicitly **not** legal documents. A terms change carries a version and an effective
    date wherever it lives, and the prototype draws a version history with a compare view — which is
    a data model, not a page. Three options: committed message catalogues like every other string;
    the configuration store, which OQ-43 excluded them from; or their own versioned table.
14. **OQ-23 — cookie consent recorded or implied. CLOSED 10 Sep 2026.** As established above, **every cookie the product
    sets is strictly necessary, so no consent is legally required and there is nothing for S-31 to
    offer.** Closed on that basis: no consent is required. S-31 keeps the disclosure and loses the choice; whether it stays a screen is task 75.1's. If analytics is ever built, consent ships in the same change. (This was cited as OQ-16 in four places, which is a different question in that register — the row is OQ-23.) Superseded text follows for reference:
    decide to build the analytics the prototype assumed and then build consent with it. The cookie
    policy cannot be published without choosing.

## A note on the Russian version

Not drafted. The repository rule is that all three locales are separately authored and never
machine-translated — Romanian is the source. A Russian version needs a Russian-speaking author
working from the Romanian, which is a different job from translating these.
