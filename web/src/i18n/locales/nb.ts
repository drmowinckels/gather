import type { Catalog } from "./en";
import type { LocaleMeta } from "../types";

export const meta: LocaleMeta = { label: "Norsk", order: 20 };

// Norwegian Bokmål. Typed as `Catalog`, so tsc fails the build if a key from
// `en` is missing, mistyped, or a plural group is flattened to a string.
export const nb: Catalog = {
  // ── nav / chrome ──
  "nav.primary": "Hovedmeny",
  "nav.skipToContent": "Hopp til innhold",
  "nav.api": "API",
  "nav.about": "Om",
  "nav.github": "GitHub",
  "nav.newPoll": "Ny avstemning",

  "theme.toLight": "Bytt til lyst tema",
  "theme.toDark": "Bytt til mørkt tema",

  "lang.switchTo": "Bytt språk til {language}",

  "footer.label": "Bunntekst",
  "footer.tagline": "finn et tidspunkt, sammen.",
  "footer.docs": "Dokumentasjon",
  "footer.support": "Spander en kaffe",

  // ── landing ──
  "landing.eyebrow": "Gruppeplanlegging, én delt lenke",
  "landing.title": "Finn et tidspunkt,\nsammen.",
  "landing.subcopy":
    "Mal inn når du er ledig, del én lenke, og se gruppas beste tidspunkt lyse opp. Ingen konto nødvendig — og hver avstemning er tilgjengelig fra API-et.",
  "landing.ctaCreate": "Lag en avstemning",
  "landing.ctaApi": "Utforsk API-et",
  "landing.step1.title": "Mal inn timene dine",
  "landing.step1.body":
    "Klikk og dra over rutenettet for å markere når du er ledig. Ingen konto, ingen kalendersynk.",
  "landing.step2.title": "Se det samle seg",
  "landing.step2.body":
    "Et levende varmekart løfter fram tidspunktet som passer for flest, med de nest beste tett bak.",
  "landing.step3.title": "Automatiser det",
  "landing.step3.body":
    "Hver avstemning er en REST-ressurs, så en CLI eller en bot kan åpne en og lese ut det vinnende tidspunktet.",

  // ── results (shared) ──
  "results.peopleFree": {
    one: "{count} person ledig",
    other: "{count} personer ledige",
  },

  // ── about ──
  "about.eyebrow": "Om",
  "about.heroTitle": "Vi gjorde den kjedelige delen smertefri.",
  "about.heroLede":
    "samkoma er et lite, uavhengig verktøy for den evig irriterende jobben med å finne et tidspunkt som passer for en gruppe. Én lenke, ingen kontoer, og et levende varmekart som lyser opp tidspunktet flest kan møte. Det er hele greia.",
  "about.whyTitle": "Hvorfor det fungerer slik",
  "about.whyLead":
    "Noen få bevisste valg, hvert av dem for å holde seg unna veien din.",
  "about.principle1.title": "Aldri kontoer",
  "about.principle1.body":
    "Du skal ikke trenge å registrere deg for å svare på «når er du ledig?» Ingen lager en profil, ingen havner på en liste. Avstemninger utløper av seg selv og forsvinner i det stille.",
  "about.principle2.title": "Én lenke gjør jobben",
  "about.principle2.body":
    "Del en enkelt lenke. Folk maler inn når de er ledige — på en telefon, i sin egen tidssone — og går videre. Ingen app å installere, ingen invitasjon å godta.",
  "about.principle3.title": "Dataene dine er ikke produktet",
  "about.principle3.body":
    "Det er ingenting å tjene penger på her. En avstemning inneholder bare det den trenger for å gjøre jobben sin, og den slettes når den er ferdig.",
  "about.principle4.title": "API-først, ikke API-en gang",
  "about.principle4.body":
    "Alt nettstedet gjør er et offentlig REST-kall, så et skript eller en bot kan kjøre nøyaktig samme flyt. Nettappen er bare én høflig klient.",
  "about.originTitle": "Hvor det kommer fra",
  "about.originPara1a": "samkoma startet som planleggingshjernen bak",
  "about.originPara1b":
    ", RLadies+-fellesskapets bot — men det er bygd for å stå på egne ben. Jinx er bare én bruker av det offentlige API-et; hvem som helst kan bli en annen. Produktet er bevisst",
  "about.independent": "uavhengig",
  "about.originPara1c":
    ": ikke bundet til noe enkelt fellesskap eller selskap, og ikke noens vekstkanal.",
  "about.originPara2":
    "Det er åpen kildekode og vedlikeholdes av Dr. Athanasia Mowinckel. Hvis du vil se hvordan det er bygd, melde en sak eller sende en rettelse, finnes alt på",
  "about.freeTitle": "Holde det gratis",
  "about.freeBody":
    "samkoma kjører på gratisnivåer og er fortsatt gratis å bruke — ingen betalingsmurer, ingen «pro»-plan. Hvis det sparte deg for en e-posttråd eller to og du vil bidra til driften, kan du spandere en kaffe på meg. Helt frivillig, oppriktig verdsatt.",
  "about.supportCta": "Spander en kaffe",
  "about.ctaTitle": "Klar for å finne et tidspunkt?",
  "about.ctaCreate": "Lag en avstemning",
  "about.ctaApi": "Utforsk API-et",

  // ── apiPage ──
  "apiPage.example.windowTitle": "lag en avstemning",
  "apiPage.hero.title": "Én avstemning, to inngangsdører.",
  "apiPage.hero.lede":
    "Alt du kan gjøre ved å klikke, kan du gjøre med en forespørsel. Nettappen, CLI-en og roboter som Jinx snakker alle med det samme offentlige REST-API-et. Ingen SDK å lære — det er bare HTTP og JSON.",
  "apiPage.action.openConsole": "Åpne interaktiv konsoll ↗",
  "apiPage.action.viewRawSpec": "Vis rå spesifikasjon ↗",
  "apiPage.action.sourceOnGitHub": "Kildekode på GitHub ↗",
  "apiPage.action.createPoll": "Lag en avstemning →",
  "apiPage.reference.heading": "Referanse",
  "apiPage.reference.lead.before":
    "Ingen kontoer: når du lager en avstemning får du et redigerings-token, sendt som",
  "apiPage.reference.lead.after":
    "for handlinger kun for vert. Utvid et hvilket som helst endepunkt for å se parametere, kropp og svar. Den interaktive konsollen legger til en «prøv det»-kjører.",
  "apiPage.reference.loadFailed": "Referansen kunne ikke lastes.",
  "apiPage.reference.openDocs": "Åpne den interaktive dokumentasjonen ↗",
  "apiPage.reference.or": "eller",
  "apiPage.reference.viewRawSpec": "vis den rå spesifikasjonen ↗",
  "apiPage.reference.instead": "i stedet.",
  "apiPage.reference.loading": "Laster referansen…",
  "apiPage.bots.heading": "Laget for roboter",
  "apiPage.bots.lead":
    "Fordi API-et er produktet, er automatisering ikke noe påheng. Jinx, RLadies+-roboten, gjør en kommentar på en GitHub-sak om til en avstemning — og redigerer så sitt eget svar med det vinnende tidspunktet når alle har svart.",
  "apiPage.bots.repliedJustNow": "svarte akkurat nå",
  "apiPage.bots.pollsUp": "📋 Avstemningen er klar!",
  "apiPage.bots.editNote":
    "Jeg redigerer denne kommentaren med det vinnende tidspunktet når alle har svart.",
  "apiPage.build.heading": "Begynn å bygge",

  // ── miniheat ──
  "miniheat.ariaLabel":
    "Forhåndsvisning av et varmekart over gruppas tilgjengelighet som samles om et felles tidspunkt",
  "miniheat.title": "Gruppetilgjengelighet",
  "miniheat.respondents": {
    one: "{count} deltaker",
    other: "{count} deltakere",
  },
  "miniheat.mon": "MAN",
  "miniheat.tue": "TIR",
  "miniheat.wed": "ONS",
  "miniheat.thu": "TOR",
  "miniheat.fri": "FRE",
  "miniheat.fewer": "færre",
  "miniheat.everyone": "alle",

  // ── qr ──
  "qr.tooLong": "Den lenken er for lang til å få plass i en QR-kode.",
  "qr.downloadSvg": "Last ned SVG",
  "qr.downloadPng": "Last ned PNG",

  // ── apiRef ──
  "apiRef.parameters": "Parametere",
  "apiRef.requestBody": "Forespørselskropp",
  "apiRef.responses": "Svar",
  "apiRef.optional": "valgfri",
  "apiRef.in": "i {location}",
  "apiRef.defaultsTo": "standard er",

  // ── calendar ──
  "calendar.prevMonth": "Forrige måned",
  "calendar.nextMonth": "Neste måned",
  "calendar.chooseDatesIn": "Velg datoer i {month}",
  "calendar.lockedDay": "Allerede i avstemningen — kan ikke fjernes",

  // ── create ──
  "create.heading.new": "Ny avstemning",
  "create.heading.duplicate": "Dupliser avstemning",
  "create.lede.new":
    "To minutter, ingen konto. Du får en lenke å dele og en redigeringslenke å ta vare på.",
  "create.lede.duplicateDates":
    "Kopierte innstillingene fra avstemningen din — velg nå de nye datoene.",
  "create.lede.duplicateOther":
    "Kopierte innstillingene fra avstemningen din — juster hva du vil nedenfor.",
  "create.error.api":
    "Vi kunne ikke lage avstemningen. Sjekk feltene og prøv igjen.",
  "create.error.network":
    "Får ikke kontakt med samkoma-tjenesten. Sjekk tilkoblingen din og prøv igjen.",
  "create.title.label": "Hendelsesnavn",
  "create.title.placeholder": "Teamsamling — september",
  "create.days.label": "Hvilke dager?",
  "create.kind.ariaLabel": "Avstemningstype",
  "create.kind.dates": "Bestemte datoer",
  "create.kind.weekdays": "Ukedager",
  "create.days.datesHint":
    "Trykk på en dag, eller dra over flere. Bruk ‹ › for å nå en annen måned.",
  "create.days.weekdaysHint":
    "Velg ukedagene som gjentar seg — tidene holder seg i avstemningens hjemtidssone.",
  "create.days.noneSelected": "Ingen dager valgt ennå.",
  "create.days.countSelected": {
    one: "{count} dag valgt.",
    other: "{count} dager valgt.",
  },
  "create.from.label": "Ikke tidligere enn",
  "create.to.label": "Ikke senere enn",
  "create.slot.label": "Tidspunktstørrelse",
  "create.slot.minutes": {
    one: "{count} min",
    other: "{count} min",
  },
  "create.time.invalid": "Sluttiden må være etter starttiden.",
  "create.tz.label": "Tidssone",
  "create.tz.hint":
    "Dette er avstemningens hjemtidssone. Deltakere maler inn i sin egen.",
  "create.deadline.label": "Svarfrist",
  "create.optional": "(valgfritt)",
  "create.deadline.hint":
    "Etter dette slutter avstemningen å ta imot tilgjengelighet. Du kan også lukke den for hånd når som helst.",
  "create.capacity.label": "Kapasitet per tidspunkt",
  "create.capacity.placeholder": "f.eks. 8",
  "create.capacity.hint":
    "Et tidspunkt vises som «fullt» når så mange personer er ledige i det. La stå tomt for ingen grense.",
  "create.toggle.public": "Gjør resultatene offentlige",
  "create.toggle.hideResults": "Skjul resultatene til jeg avslører dem",
  "create.toggle.defaultAvailable":
    "Start alle som ledige (de markerer opptatt)",
  "create.submit.busy": "Lager…",
  "create.submit.idle": "Lag avstemning",
  "create.cli.label": "CLI-ekvivalent",
  "create.cli.hint":
    "Skjemaet og CLI-en treffer det samme endepunktet. Alt du kan klikke, kan et skript gjøre.",

  // ── edit ──
  "edit.error.notAdditive":
    "Redigering er additiv — du kan legge til dager eller utvide vinduet, men ikke fjerne en dag eller et tidspunkt folk allerede kan ha svart på.",
  "edit.error.fromAfterTo": "Slutttidspunktet må være etter starttidspunktet.",
  "edit.error.slotChangeUnsupported":
    "Tidspunktstørrelsen kan ikke endres etter at en avstemning er opprettet.",
  "edit.error.invalidBody": "Sjekk feltene og prøv igjen.",
  "edit.error.generic": "Vi klarte ikke å lagre endringene.",
  "edit.error.network":
    "Får ikke kontakt med samkoma-tjenesten. Sjekk tilkoblingen og prøv igjen.",
  "edit.heading": "Rediger avstemning",
  "edit.close": "Lukk",
  "edit.eventName": "Navn på hendelse",
  "edit.days": "Dager",
  "edit.existingDay": "Eksisterende dag — kan ikke fjernes",
  "edit.daysHelp":
    "Du kan legge til dager, men eksisterende (ringet, fast) blir værende — folk kan ha svart for dem.",
  "edit.noEarlierThan": "Ikke tidligere enn",
  "edit.noLaterThan": "Ikke senere enn",
  "edit.slotSize": "Tidspunktstørrelse",
  "edit.slotMinutes": "{slot} min",
  "edit.windowHelp":
    "Du kan bare utvide vinduet (tidligere start, senere slutt), og tidspunktstørrelsen er fast.",
  "edit.makePublic": "Gjør resultater offentlige",
  "edit.hideResults": "Skjul resultater til jeg viser dem",
  "edit.saving": "Lagrer…",
  "edit.save": "Lagre endringer",
  "edit.public.warningLead": "Obs:",
  "edit.public.warningBody":
    "å gjøre resultater offentlige avslører navnene og den inntegnede tilgjengeligheten til alle som allerede har svart mens denne avstemningen var privat. Dette kan ikke angres for svar de allerede har gitt.",
  "edit.public.confirm": "Jeg forstår — gjør tidligere svar offentlige",

  // ── filter ──
  "filter.toggle": "Filtrer personer",
  "filter.counting": {
    one: "Teller {included} av {total} person",
    other: "Teller {included} av {total} personer",
  },
  "filter.groupsLabel": "Grupper som telles med i resultatene",
  "filter.peopleLabel": "Personer som telles med i resultatene",
  "filter.reset": "Nullstill — tell alle",

  // ── grid ──
  "grid.state.available": "ledig",
  "grid.state.maybe": "kanskje",
  "grid.state.busy": "opptatt",
  "grid.slot": "{day}, {time}",
  "grid.cellLabel": "{day}, {time} — {state}",
  "grid.cellLabelConflict": "{day}, {time} — {state} — kalenderkonflikt",
  "grid.announce": "{slot} — {state}",
  "grid.conflictDot": "Opptatt i kalenderen din",

  // ── heatmap ──
  "heatmap.title": "Gruppens ledighet",
  "heatmap.responsesOf": "{total} av {names} svar",
  "heatmap.responses": {
    one: "{count} svar",
    other: "{count} svar",
  },
  "heatmap.downloadCsv": "Last ned CSV",
  "heatmap.emptyTitle": "Ingen ledighet ennå",
  "heatmap.emptyFilteredTitle": "Ingen i dette utvalget",
  "heatmap.emptyBody":
    "Når folk maler inn de ledige tidene sine, lyser gruppens beste tidspunkt opp her.",
  "heatmap.emptyFilteredBody": "Legg noen tilbake for å se hvor de overlapper.",
  "heatmap.byGroup": "Etter gruppe:",
  "heatmap.srCaption":
    "Gruppens ledighet etter tidspunkt, {total} av {names} svar telt. Beste tidspunkt {time} med {count} ledige.",
  "heatmap.colTimeSlot": "Tidspunkt",
  "heatmap.colAvailable": "Ledig",
  "heatmap.colMaybe": "Kanskje",
  "heatmap.srCount": "{count} av {total}",
  "heatmap.srFull": " (fullt)",
  "heatmap.cellEmpty": "{time} — ingen ennå",
  "heatmap.cellAvailable": "{time} — {count} av {total} ledige",
  "heatmap.cellMaybeSuffix": ", {count} kanskje",
  "heatmap.cellFullSuffix": " — fullt",
  "heatmap.cellAriaLockable": "{desc}. Velg for å låse.",
  "heatmap.legendMaybe": "kanskje",
  "heatmap.legendFull": "fullt",
  "heatmap.bestSlot": "Beste tidspunkt",
  "heatmap.bestSlotCount": "{count} / {total} ledige",
  "heatmap.bestSlotMaybeSuffix": " · {count} kanskje",
  "heatmap.bestSlotAllIn": " · alle med",
  "heatmap.runnerUps": "Nest beste",
  "heatmap.thisSlot": "Dette tidspunktet",
  "heatmap.detailAvailable": "Ledig · {count}",
  "heatmap.detailMaybe": "Kanskje · {count}",
  "heatmap.lockedLabel": "Låst:",
  "heatmap.unlock": "Lås opp",
  "heatmap.locking": "Låser…",
  "heatmap.lockIn": "Lås {time}",
  "heatmap.pickHintSelected": "Trykk på et annet tidspunkt for å endre valget.",
  "heatmap.pickHintDefault":
    "Beste tidspunkt valgt — trykk på et tidspunkt for å velge et annet.",

  // ── poll ──
  "poll.noDays": "Ingen dager ennå",
  "poll.dayCount": { one: "{count} dag", other: "{count} dager" },
  "poll.loading": "Laster avstemning…",
  "poll.notFound.title": "Denne avstemningen finnes ikke her",
  "poll.notFound.body":
    "Lenken kan være feilskrevet, eller avstemningen ble aldri opprettet. Start en ny og del den nye lenken.",
  "poll.notFound.cta": "Lag en avstemning",
  "poll.expired.title": "Denne avstemningen er utløpt",
  "poll.expired.body":
    "Avstemninger er aktive i 14 dager etter siste dag, så blir de slettet. Start en ny til neste sammenkomst.",
  "poll.expired.cta": "Lag en avstemning",
  "poll.error.title": "Får ikke lastet denne avstemningen nå",
  "poll.error.body":
    "samkoma-tjenesten svarte ikke. Last inn på nytt for å prøve igjen.",
  "poll.error.refresh": "Last inn på nytt",
  "poll.tz.showingIn": "Viser tidspunkter i",
  "poll.tz.selectLabel": "Vis tidspunkter i tidssone",
  "poll.tz.convertedFrom": "konvertert fra {tz}",
  "poll.tz.noteLabel": "merknad om tidssone",
  "poll.tz.weekdayNote":
    "Ukedagstidspunkter vises i avstemningens hjemmetidssone, {tz}.",
  "poll.youHost": "Du er vert her",
  "poll.editPoll": "Rediger avstemning",
  "poll.duplicate": "Dupliser",
  "poll.meta": "{slot}-min tidspunkter · hjemmetidssone {tz}",
  "poll.responding.closed": "🔒 Svar er lukket",
  "poll.responding.closesAt": "Svarfristen er {date}",
  "poll.responding.open": "Åpent for svar",
  "poll.reopen": "Gjenåpne",
  "poll.closeNow": "Lukk nå",
  "poll.closeError": "Kunne ikke oppdatere — prøv igjen.",
  "poll.lockedIn": "📌 Låst:",
  "poll.addToCalendar": "Legg til i kalender",
  "poll.curtain.hostHidden":
    "🙈 Resultatene er skjult for deltakerne til du viser dem.",
  "poll.curtain.revealError": "Kunne ikke vise — prøv igjen.",
  "poll.curtain.reveal": "Vis resultater",
  "poll.private.curtainedTitle": "Resultatene er skjult inntil videre",
  "poll.private.privateTitle": "Resultatene er private",
  "poll.private.curtainedBody":
    "Verten holder gruppens resultater skjult til de viser dem. Tilgjengeligheten din er lagret.",
  "poll.private.privateBody":
    "Verten holdt gruppens resultater private. Tilgjengeligheten din er lagret.",
  "poll.share.label": "Del denne lenken",
  "poll.share.inputLabel": "Delbar avstemningslenke",
  "poll.copied": "Kopiert",
  "poll.copy": "Kopier",
  "poll.qr.hide": "Skjul QR",
  "poll.qr.show": "QR",
  "poll.qr.label": "QR-kode som lenker til denne avstemningen",
  "poll.share.copiedStatus": "Lenke kopiert til utklippstavlen",
  "poll.share.anyone":
    "Alle med denne lenken kan legge til tilgjengeligheten sin — ingen konto nødvendig.",
  "poll.share.activeUntil": "Lenken er aktiv til {date}.",
  "poll.host.label": "🔑 Vertslenken din",
  "poll.host.inputLabel": "Privat vertslenke",
  "poll.host.hint":
    "Hold denne privat — alle med den kan låse avstemningen og se private resultater. Åpne den på en annen enhet for å administrere derfra.",

  // ── respond ──
  "respond.error.nameProtected":
    "Det navnet er beskyttet. Skriv inn passordet for å redigere, eller velg et annet navn.",
  "respond.error.saveFailed": "Kunne ikke lagre — prøv igjen.",
  "respond.error.network":
    "Får ikke kontakt med samkoma. Sjekk tilkoblingen din.",
  "respond.overlay.tooLarge": "Den kalenderfilen er for stor (over 5 MB).",
  "respond.overlay.noEvents":
    "Ingen hendelser funnet i denne avstemningens periode.",
  "respond.overlay.marked": {
    one: "Markerte {count} opptatt tidspunkt fra kalenderen din — ingenting ble lastet opp.",
    other:
      "Markerte {count} opptatte tidspunkt fra kalenderen din — ingenting ble lastet opp.",
  },
  "respond.overlay.recurring": {
    one: " ({count} gjentakende hendelse kunne ikke utvides.)",
    other: " ({count} gjentakende hendelser kunne ikke utvides.)",
  },
  "respond.overlay.readFailed":
    "Kunne ikke lese den filen — er det en .ics-kalender?",
  "respond.bulk.allAvailable": "Alle tidspunkt markert som ledige.",
  "respond.bulk.allCleared": "Alle tidspunkt fjernet.",
  "respond.closed.title": "Svar er stengt",
  "respond.closed.body":
    "Denne avstemningen tar ikke lenger imot tilgjengelighet.",
  "respond.details.heading": "Dine opplysninger",
  "respond.name.label": "Navnet ditt",
  "respond.name.placeholder": "f.eks. Ada",
  "respond.group.label": "Gruppe",
  "respond.optional": "(valgfritt)",
  "respond.group.placeholder": "f.eks. Designteam",
  "respond.group.helper":
    "Knytt deg til et team for å se opptellinger per gruppe i resultatene.",
  "respond.password.label": "Redigeringspassord",
  "respond.password.placeholder": "for å redigere fra en annen enhet",
  "respond.password.helper":
    "La stå tomt for å holde dette svaret til denne nettleseren. Sett et for å gjøre krav på navnet ditt og redigere det andre steder.",
  "respond.calendar.overlay": "Legg over kalenderen min (.ics)",
  "respond.calendar.blockOut": "Blokker av opptatte tidspunkt",
  "respond.bulk.selectAll": "Velg alle",
  "respond.bulk.clearAll": "Fjern alle",
  "respond.bulk.helper":
    "Marker alt som ledig, og mal så inn når du er opptatt.",
  "respond.availability.heading": "Din tilgjengelighet",
  "respond.availability.helperDefaultAvailable":
    "Du starter markert som ledig overalt — mal inn tidspunktene du er opptatt. Hvert trykk veksler et tidspunkt: ledig → kanskje → tøm.",
  "respond.availability.helper":
    "Klikk eller dra for å markere når du er ledig. Hvert trykk veksler et tidspunkt: ledig → kanskje → tøm.",
  "respond.save.saving": "Lagrer…",
  "respond.save.button": "Lagre tilgjengelighet",
  "respond.save.addName": "Legg til navnet ditt for å lagre.",
  "respond.save.saved": "Lagret",
  "respond.save.liveSaving": "Lagrer tilgjengeligheten din",
  "respond.save.liveSaved": "Tilgjengelighet lagret",

  // ── format ──
  "format.ariaTrigger": "Dato- og tidsformat",
  "format.time": "Klokkeslett",
  "format.date": "Dato",
  "format.auto": "Auto",
  "format.h12": "12t",
  "format.h24": "24t",
  "format.iso": "ISO",
};

export default nb;
