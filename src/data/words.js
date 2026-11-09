// Lowercase English words (letters and apostrophes only). Filtered per zone by allowed characters.
const RAW = `
a ad add adds ads all alas alfalfa as ask asks dad dads fad fads fall falls flak flask flasks
lad lads lass sad salad salads sass ska skald skalds la flasks alls salsa
age aid ail aide ailed aisle ash ashes aside ease eel egg eggs else elf elk fade faded fail
failed fake false fee feed feel feels fief field fields fig file filed fill filled fish flag
flake flash flee fled flesh fleshed glad glade glades glass glee glide glided had hail hails
half hall halls has he head heads heal healed heals heel held hid hide hides high hike hiked
hill hills his idea ideas ideal if is jade jail jails jig keel keg kid kids kill killed kiss
lake lakes laid lead leads leaf leak led leg legs lid lie lied lies life like liked likes
lash leash sage sail sailed sale sea seal sealed see seed seeds seek seeks self sell shade
shaded shake shall she shed sheep shelf shell shield shields side sides sigh silk skill
skills skid slide sled sea dish fish desk deal deals dial die died dies did dig digs dash deed
deeds deeds jelly sheik khaki salsa ideal flies fished shake hike highlands gadget leafs
gal gale gales gash gel gild gilded giggle hag haggle hedge hedges heed hie easel sieged
liege lilies hassle fiddle giddy shelled shield hailed jagged keels alike
after again air also alter are area arise art artist as at ate aura auras far fare fast
fat fault fear feast feat feet fire first fit flare flat flier frail fresh fried frost fruit
fur further gate gather gift girl great greed grief grit guard guess guide guilt guitar
hair hard hare harsh hart haste hat hate hear heard heart heat her here hero hers hut
iris it its jar jest jet just kite rage raid rail raise rat rate rays read real rear red
refer reef relay relief rest rid ride rider rift right rise risk rite rug rule rules
rush rust sat saturday sea seat set shirt shut sir sister sit site skirt slate sleet
star start state stay steel stir straight street stress strike stuff suit sure surf
tail tale talk task taste tea tear teeth tell test that the their them then there these
they this thrust thus tide tie tiger tight tired title to treat tree tries true trust
truth try turf turtle tusk yard year years yes yet yeti you your yarn yell yield
ruthless thirst thirsty fury fiery tired tray treasury duty dusty rusty fruity sturdy
hurry hurt hurts guilty tasty dirty fifty eighty stray trays stairs strays grudge
ruler further tutor letter little attest restart rattle settle shudder shutter
about above across act actor after again against age ago all allow almost alone along
already also always among an and anger angle angry animal answer any anyone anything
appear apple are arm army around arrow art as ask attack away awake axe
back bad bag ball band bank bar base basket bat battle be bear beast beat beautiful became
because become bed been before began begin behind being believe bell below belt bench bend
beneath beside best better between beyond big bird bit bite black blade blaze bless blind
block blood bloom blow blue board boat body bold bolt bone book boot border born both
bottle bottom bound bow bowl box boy brain branch brave bread break breath breeze brick
bridge bright bring broad broke broken brother brought brown brush build built burn burning
burst bury bush busy but buy by cabin cage cake call calm came camp can candle cannot cap
captain card care carry case cast castle cat catch caught cause cave cell center chain
chair chance change chant charge charm chase cheap check chest chief child choice choose
circle city claim class claw clean clear clever cliff climb clock close cloth cloud coal
coast coat code coin cold collect color come command common company complete copper core
corner could count country courage course court cover cow crack craft crane crash crawl
cream create creature crew cross crow crowd crown cruel crumble crush cry crystal cup
curse curve cut daily damp dance danger dare dark darkness dawn day dead deal dear death
decide deep deer defend demon den depth desert design destroy detail devil dew diamond
did different dig dinner direct dirt discover distant dive divide do doctor does dog done
door double doubt dove down dozen drag dragon drain drama draw dread dream dress drift
drink drive drop drown drum dry duck due dull dungeon during dusk dust each eager eagle
ear early earn earth east easy eat echo edge effort eight either elder eleven ember empire
empty end enemy energy enough enter entire equal escape even evening event ever every
evil exact example except exist expect eye face fact fair fairy faith fall family famous
fang far farm fate father favor feather feed feel fellow fence fever few fiend fifteen
fight figure final find fine finger finish fire firm fish fist five flame flight float
flock flood floor flow flower fly focus fog fold follow food fool foot for force forest
forge forget form fort forth fortune forward found four fox free freeze friend frog from
front frozen full fun future gain game garden gas gate gave gem general gentle get ghost
giant give glad glance glass gleam glory glove glow go goal goat god gold golden gone good
got govern grab grace grand grass grave gray green grew grim grip ground group grow growl
guard guess guest guide guild gun habit hall hammer hand hang happen happy harbor hard harm
harp have hawk head health heap hear heavy height hello help herb hidden hill him himself
history hit hold hole holy home honey honor hook hope horn horse host hot hound hour house
how however huge human humble hundred hunger hunt hunter hurry ice icy idea if image imagine
important in inch indeed inside iron island it its itself jewel job join joke journey joy
judge jump jungle just keen keep key kind king kingdom kitchen knee knew knife knight knock
knot know knowledge lady lamp land lantern large last late laugh law lay lazy lead leader
learn least leather leave left legend lemon lesson let letter level library lift light
lightning like limb line lion lip list listen little live lock lonely long look loose lord
lose loss lost lot loud love low loyal luck lunar machine mad made magic main major make
male man many map march mark market marsh mask master match matter may maze meadow meal
mean measure meat meet melt member memory mercy merry message metal middle might mild mile
milk mind mine minute mirror miss mist mix moment money monk monster month moon more morning
moss most mother mountain mouse mouth move much mud music must my mystery nail name narrow
nation nature near neck need needle nest net never new next nice night nine no noble nobody
nod noise none noon nor north nose not note nothing notice now number oak oath obey ocean
odd of off offer often oil old omen on once one only open or orange orb order other our
out over own owl pack page pain paint pair palace pale palm paper part party pass past
path pause pay peace peak pearl people perfect perhaps person pick picture piece pig pile
pillar pine pink pipe pit place plain plan plant plate play please plenty pocket poem point
poison pole pond pony pool poor portal position possible potion pound pour power praise
pray prepare present press pretty price pride prince princess print prison prize problem
promise proof proud prove pull pulse pure purple purpose push put queen quest question
quick quiet quite rabbit race rain raise ran range rapid rare raven reach ready realm reason
recall record reign remain remember repeat reply rescue rest return reward rhyme rich
riddle ring ripe river road roar robe rock rod role roll roof room root rope rose rough
round row royal rub ruin run rune rust sacred safe said sail saint salt same sand sang save
saw say scale scar scene school scroll sea search season second secret see seek seem
seen send sense sent serve seven shadow shake shape share sharp shelter shine ship shiver
shock shoe shoot shop shore short should shoulder shout show shrine shy sick sight sign
silence silent silver simple since sing single sink six size skin sky sleep slow small
smell smile smoke smooth snake snow so soft soil sold soldier solid some someone son song
soon sorrow soul sound south space spark speak spear special speed spell spend spider spin
spirit spoke spot spring square staff stage stand stone stood stop storm story strange
stream strong student study sudden sugar summer summon sun supper swamp swift sword
symbol table take talk tall tame teach team temple ten tent terror than thank thick thief
thin thing think third thorn those though thought thousand three throne through throw
thunder ticket time tiny tired today together told tomb tomorrow tone tongue tonight too
took tool top torch total touch toward tower town toy trace track trade trail train trap
travel treasure trick troll trouble truly turn twelve twenty twice twin two under unless
until up upon us use useful usual valley value vapor vast veil very view village vine
violet voice void wait wake walk wall wand wander want war ward warm warn was wash watch
water wave way we weak wealth wear weather weave web week weight welcome well went were
west wet whale what wheel when where which while whisper white who whole why wide wild will
win wind window wine wing winter wire wisdom wise wish witch with within without wizard
wolf woman wonder wood word wore work world worm worry worth would wound wrap write wrong
yellow young youth zeal zero zone
quiz quill quiver quake quartz quaint quarrel quench query squire squid squad squeak equip
liquid unique antique opaque oblique quarter quantum
jazz zap zest zinc zigzag buzz fizz fuzz blaze glaze haze maze daze gaze graze breeze
freeze frozen lazy crazy dizzy fuzzy wizard lizard hazard bizarre dozen zombie zephyr
box fox ox oxen axe wax tax six sixty mix fix flax hex vex lynx onyx exile exit expert
extra index pixel relax sphinx toxic waxen boxer phoenix vortex helix
spellbook manuscript glyph glyphs runic arcane cantrip familiar grimoire incant chant oracle
sorcery sorcerer warlock shaman druid paladin rogue ranger bard cleric alchemy elixir
amulet talisman relic artifact crypt catacomb citadel bastion rampart keep goblin orc ogre
wyvern basilisk griffin hydra kraken golem specter wraith banshee imp sprite nymph sylph
elven dwarven mithril obsidian ivory amber cobalt crimson azure scarlet silverleaf moonlit
starlit nightfall daybreak twilight eclipse comet meteor nova aurora tempest gale squall
thunderbolt wildfire inferno cinder ash ashen embers frostbite glacier tundra blizzard
mana valor glory honor doom fate omen prophecy legend myth saga epic hero villain quest
dungeon labyrinth treasure loot hoard chest key lock portal rift void abyss chaos order
don't can't it's i'll we're you're isn't won't that's let's they're i'm we'll you'll he's
she's there's what's didn't doesn't wasn't aren't couldn't shouldn't wouldn't haven't i've
`;

const seen = new Set();
export const WORDS = [];
for (const w of RAW.split(/\s+/)) {
  if (!w || seen.has(w)) continue;
  if (!/^[a-z']+$/.test(w)) continue;
  seen.add(w);
  WORDS.push(w);
}
