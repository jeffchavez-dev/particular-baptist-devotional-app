import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/* ─── 37 Questions ─── */
const QUESTIONS = [
  // EASY — Scripture & Basics
  {
    id: 1,
    level: 'easy',
    category: 'Scripture',
    q: 'What do Particular Baptists hold to be the only sufficient and infallible rule of faith and practice?',
    options: [
      'Scripture and Church Tradition',
      'The Holy Scriptures of the Old and New Testaments',
      'Scripture, Tradition, and the Pope',
      'The New Testament alone',
    ],
    answer: 1,
  },
  {
    id: 2,
    level: 'easy',
    category: 'Soteriology',
    q: 'What does the term "Particular" in Particular Baptist refer to?',
    options: [
      'A particular style of worship',
      'Particular churches rather than a denomination',
      'Particular (definite) atonement — Christ died for the elect specifically',
      'Particular days of fasting',
    ],
    answer: 2,
  },
  {
    id: 3,
    level: 'easy',
    category: 'Ecclesiology',
    q: 'What is the proper mode of baptism according to Particular Baptist convictions?',
    options: [
      'Sprinkling of infants',
      'Pouring of water on the head',
      'Immersion of believers upon profession of faith',
      'Any mode is acceptable',
    ],
    answer: 2,
  },
  {
    id: 4,
    level: 'easy',
    category: 'History',
    q: 'The 2LBCF was first circulated in 1677, then formally adopted by Particular Baptist churches in what year?',
    options: ['1658', '1677', '1689', '1707'],
    answer: 2,
  },
  {
    id: 5,
    level: 'easy',
    category: 'Theology Proper',
    q: 'How many persons are in the one God, according to the 2LBCF?',
    options: ['One', 'Two', 'Three', 'Many'],
    answer: 2,
  },
  {
    id: 6,
    level: 'easy',
    category: 'Soteriology',
    q: 'What is the doctrine of "total depravity"?',
    options: [
      'Man is as sinful as he possibly could be in every action',
      'Sin has corrupted every aspect of human nature, leaving man unable to save himself',
      'God causes people to sin',
      'Only the body is corrupted by sin, not the soul',
    ],
    answer: 1,
  },
  {
    id: 7,
    level: 'easy',
    category: 'Ecclesiology',
    q: 'What are the two ordinances (sacraments) recognised by Particular Baptists?',
    options: [
      "Baptism and the Lord's Supper",
      "Baptism, the Lord's Supper, and Confirmation",
      "The Lord's Supper and Foot-washing",
      'Baptism, Marriage, and Holy Orders',
    ],
    answer: 0,
  },
  {
    id: 8,
    level: 'easy',
    category: 'Scripture',
    q: 'What does the 2LBCF teach about the sufficiency of Scripture?',
    options: [
      'Scripture must be supplemented by ongoing prophecy',
      'Scripture contains all things necessary for salvation and life, with nothing to be added',
      'The church magisterium interprets Scripture authoritatively',
      'New revelation may be added as needed',
    ],
    answer: 1,
  },

  // MEDIUM — Confessional Doctrine
  {
    id: 9,
    level: 'medium',
    category: 'Soteriology',
    q: 'Which of the following best describes "effectual calling"?',
    options: [
      'A general call to repentance given to all who hear the gospel',
      'God\'s inward work by His Spirit drawing the elect to saving faith irresistibly',
      'The preacher\'s persuasive call to the congregation',
      'A second blessing after initial conversion',
    ],
    answer: 1,
  },
  {
    id: 10,
    level: 'medium',
    category: 'Covenant Theology',
    q: 'What is the "Covenant of Works"?',
    options: [
      'The Mosaic covenant given at Sinai',
      'The covenant God made with Abraham',
      'The covenant God made with Adam in creation, promising life upon perfect obedience',
      'The New Covenant established by Christ',
    ],
    answer: 2,
  },
  {
    id: 11,
    level: 'medium',
    category: 'Soteriology',
    q: 'What does Particular Baptist theology teach about the perseverance of the saints?',
    options: [
      'True believers may fall away and lose their salvation',
      'Those whom God has truly regenerated will persevere to the end and be finally saved',
      'Perseverance depends entirely on our cooperation with grace',
      'Only apostles were guaranteed to persevere',
    ],
    answer: 1,
  },
  {
    id: 12,
    level: 'medium',
    category: 'Theology Proper',
    q: 'What does the 2LBCF teach about God\'s decrees?',
    options: [
      'God decrees all things that come to pass, based on His foreknowledge of free choices',
      'God has from eternity unchangeably ordained whatsoever comes to pass, for His own glory',
      'God\'s decrees are conditional upon human response',
      'God only decrees salvation, not other events',
    ],
    answer: 1,
  },
  {
    id: 13,
    level: 'medium',
    category: 'Ecclesiology',
    q: 'How do Particular Baptists understand church government?',
    options: [
      'Episcopal — governed by bishops in succession from the apostles',
      'Presbyterian — ruled by a wider assembly of elders',
      'Congregational — each local church is self-governing under Christ',
      'Hierarchical — led by a central Baptist pope',
    ],
    answer: 2,
  },
  {
    id: 14,
    level: 'medium',
    category: 'Covenant Theology',
    q: 'What is the "Covenant of Grace"?',
    options: [
      'God\'s promise to reward good works with salvation',
      'God\'s gracious promise to save sinners through a Mediator — ultimately fulfilled in Christ',
      'The covenant established at Sinai with the ten commandments',
      'An agreement between God and the angels',
    ],
    answer: 1,
  },
  {
    id: 15,
    level: 'medium',
    category: 'Soteriology',
    q: 'What is "justification" in Reformed theology?',
    options: [
      'The process by which sinners are made inwardly righteous over time',
      'God\'s act of making the elect morally perfect',
      'God\'s legal declaration that sinners are righteous through faith in Christ\'s imputed righteousness',
      'The church\'s pronouncement of forgiveness in confession',
    ],
    answer: 2,
  },
  {
    id: 16,
    level: 'medium',
    category: 'History',
    q: 'The First London Baptist Confession (1644) was produced by how many congregations?',
    options: ['5', '7', '37', '52'],
    answer: 1,
  },
  {
    id: 17,
    level: 'medium',
    category: 'Worship',
    q: 'What does the "Regulative Principle of Worship" teach?',
    options: [
      'Worship may include anything not explicitly forbidden in Scripture',
      'Worship must be regulated by the church council',
      'Only what God has positively commanded in Scripture is permitted in corporate worship',
      'Worship forms are culturally determined and theologically neutral',
    ],
    answer: 2,
  },
  {
    id: 18,
    level: 'medium',
    category: 'Soteriology',
    q: 'What is "regeneration" according to the 2LBCF?',
    options: [
      'Water baptism which washes away original sin',
      'God\'s sovereign work by the Spirit giving new life and a new heart to the elect',
      'The gradual improvement of moral character through discipline',
      'A second work of grace after conversion',
    ],
    answer: 1,
  },

  // INTERMEDIATE — Deeper Doctrine
  {
    id: 19,
    level: 'intermediate',
    category: 'Covenant Theology',
    q: 'How do Particular Baptists typically differ from paedobaptist Reformed theologians on covenant theology?',
    options: [
      'Baptists reject covenant theology altogether',
      'Baptists hold that the New Covenant has no true members — it is merely a promise',
      'Baptists hold that New Covenant membership is composed exclusively of the regenerate, unlike the mixed Abrahamic community',
      'Baptists believe in two covenants of grace — one for Israel, one for the Church',
    ],
    answer: 2,
  },
  {
    id: 20,
    level: 'intermediate',
    category: 'Soteriology',
    q: 'What is the "active obedience" of Christ, and why is it important?',
    options: [
      'Christ\'s miracles, which proved He was the Messiah',
      'Christ\'s perfect law-keeping credited to believers, providing positive righteousness — not merely forgiveness',
      'Christ\'s suffering under Pontius Pilate',
      'The apostles\' missionary activity on Christ\'s behalf',
    ],
    answer: 1,
  },
  {
    id: 21,
    level: 'intermediate',
    category: 'Theology Proper',
    q: 'What does the doctrine of divine simplicity, affirmed in 2LBCF chapter 2, mean?',
    options: [
      'God has no parts and is not composed of distinct elements — He is not a composite being',
      'God is easy to understand',
      'God is one in number but complex in nature',
      'God\'s simplicity means He cannot be angry or sorrowful',
    ],
    answer: 0,
  },
  {
    id: 22,
    level: 'intermediate',
    category: 'Ecclesiology',
    q: 'Who were the original signatories to the 1689 Confession?',
    options: [
      'The Westminster Assembly divines',
      'Representatives of 37 Particular Baptist congregations',
      'The General Assembly of the Church of England',
      'The Five Dissenting Brethren of the Westminster Assembly',
    ],
    answer: 1,
  },
  {
    id: 23,
    level: 'intermediate',
    category: 'Covenant Theology',
    q: 'What is the "Covenant of Redemption" (Pactum Salutis)?',
    options: [
      'The covenant between God and Noah after the flood',
      'The eternal intra-Trinitarian agreement in which the Father gives a people to the Son and the Son agrees to redeem them',
      'The covenant between God and Moses at Sinai',
      'The New Covenant inaugurated by Christ\'s blood',
    ],
    answer: 1,
  },
  {
    id: 24,
    level: 'intermediate',
    category: 'Soteriology',
    q: 'What does the 2LBCF teach about the relationship between faith and repentance?',
    options: [
      'Repentance earns grace; faith is a separate gift',
      'Faith and repentance are inseparably linked saving graces, both gifts of God, neither being the basis of justification',
      'Faith alone saves; repentance is optional',
      'Repentance must precede faith logically and temporally',
    ],
    answer: 1,
  },
  {
    id: 25,
    level: 'intermediate',
    category: 'History',
    q: 'Benjamin Keach was significant in early Particular Baptist history primarily for:',
    options: [
      'Writing the 1644 Confession',
      'Introducing congregational hymn-singing and authoring the Baptist Catechism',
      'Founding the first Baptist seminary in England',
      'Translating the Bible into English',
    ],
    answer: 1,
  },
  {
    id: 26,
    level: 'intermediate',
    category: 'Christology',
    q: 'What does the 2LBCF teach about the two natures of Christ?',
    options: [
      'Christ has only one divine nature that took on the appearance of humanity',
      'Christ has two natures, divine and human, each distinct yet united in one Person without confusion or change',
      'Christ\'s divine nature absorbed His human nature at the resurrection',
      'Christ\'s humanity was only apparent, not real',
    ],
    answer: 1,
  },

  // ADVANCED — Historical & Confessional Depth
  {
    id: 27,
    level: 'advanced',
    category: 'History',
    q: 'The 2LBCF of 1689 closely follows which earlier Reformed confession, with key modifications for Baptist distinctives?',
    options: [
      'The Heidelberg Catechism (1563)',
      'The Augsburg Confession (1530)',
      'The Westminster Confession of Faith (1646)',
      'The Belgic Confession (1561)',
    ],
    answer: 2,
  },
  {
    id: 28,
    level: 'advanced',
    category: 'Covenant Theology',
    q: 'Nehemiah Coxe\'s contribution to Particular Baptist covenant theology is best described as:',
    options: [
      'Arguing that the Abrahamic covenant is identical in substance to the New Covenant',
      'Articulating that the Abrahamic covenant had two aspects — a national, typological covenant distinct from the covenant of grace proper',
      'Denying the existence of a pre-fall Covenant of Works',
      'Teaching that the Old Testament covenants are entirely abrogated with no New Testament relevance',
    ],
    answer: 1,
  },
  {
    id: 29,
    level: 'advanced',
    category: 'History',
    q: 'What was the "Midland Confession" (1655) significant for?',
    options: [
      'It was the first General Baptist confession',
      'It was an early Particular Baptist confession preceding the 1677 draft of the 2LBCF',
      'It established the Baptist World Alliance',
      'It first introduced the term "Particular Baptist" in print',
    ],
    answer: 1,
  },
  {
    id: 30,
    level: 'advanced',
    category: 'Ecclesiology',
    q: 'What does the 2LBCF chapter 26 teach about the relationship between local churches and the universal Church?',
    options: [
      'The universal Church is invisible; local churches are its visible, gathered expressions',
      'Local churches have no organic connection to the wider body of Christ',
      'The universal Church is governed by a central council of elders',
      'Local churches are provisional until the universal Church is established at Christ\'s return',
    ],
    answer: 0,
  },
  {
    id: 31,
    level: 'advanced',
    category: 'Soteriology',
    q: 'What is "definite atonement" (particular redemption), and how does it differ from general atonement?',
    options: [
      'Christ\'s death was sufficient for all but efficient only for those who believe of their own free will',
      'Christ\'s death actually secured — not merely made possible — the redemption of the elect specifically, guaranteeing their salvation',
      'Christ died only for the sins of Old Testament Israel',
      'Atonement is unlimited in scope and unconditional in application',
    ],
    answer: 1,
  },
  {
    id: 32,
    level: 'advanced',
    category: 'History',
    q: 'Hanserd Knollys is notable in Particular Baptist history for:',
    options: [
      'Writing the First London Baptist Confession',
      'Being a signer of both the 1677 and 1689 confessions and a pioneer preacher of Particular Baptist churches',
      'Founding the first Baptist college in America',
      'Translating the Westminster Confession for Baptist use',
    ],
    answer: 1,
  },
  {
    id: 33,
    level: 'advanced',
    category: 'Theology Proper',
    q: 'What does the 2LBCF mean when it says God is "without passions"?',
    options: [
      'God is emotionally indifferent and cannot care about creation',
      'God does not have involuntary emotional upheavals governed by external causes, though Scripture uses anthropopathic language of Him',
      'God never expresses love or anger in any meaningful sense',
      'God experiences emotions exactly as humans do',
    ],
    answer: 1,
  },

  // EXPERT — Fine Points
  {
    id: 34,
    level: 'expert',
    category: 'Covenant Theology',
    q: 'How do most Particular Baptists distinguish their covenant theology from that of standard Westminster Presbyterianism?',
    options: [
      'Baptists deny the Covenant of Works but accept the Covenant of Grace',
      'Baptists locate the Abrahamic covenant primarily as a national/typological covenant, not the administration of the Covenant of Grace itself, thereby rejecting paedobaptism without rejecting covenant theology',
      'Baptists follow a strict two-covenant system (Law and Gospel) like Lutheran theology',
      'Baptists see the Mosaic covenant as a republication of the Covenant of Works equal to the Adamic',
    ],
    answer: 1,
  },
  {
    id: 35,
    level: 'expert',
    category: 'History',
    q: 'The 1689 Confession was adopted and published by what gathering, and why was 1689 a significant year for English Nonconformists?',
    options: [
      'The General Baptist Assembly; it was the year of the Glorious Revolution and the Act of Toleration',
      'A general assembly of Particular Baptist churches; following the Glorious Revolution and Act of Toleration which granted Nonconformists legal freedom',
      'The Westminster Assembly; it marked the execution of Charles I',
      'The Five Dissenting Brethren; it followed the Restoration of Charles II',
    ],
    answer: 1,
  },
  {
    id: 36,
    level: 'expert',
    category: 'Christology',
    q: 'What is the "extra Calvinisticum," and do Particular Baptists generally affirm or deny it?',
    options: [
      'The teaching that Christ\'s divine nature is fully present everywhere even during His incarnation — generally affirmed as consistent with Reformed Christology',
      'The idea that Christ had an "extra" divine person — generally denied as modalist',
      'The teaching that Christ\'s humanity was sinful — generally denied as heretical',
      'Calvin\'s unique view that Christ descended literally to hell — generally denied as speculative',
    ],
    answer: 0,
  },
  {
    id: 37,
    level: 'expert',
    category: 'Theology Proper',
    q: 'In the 2LBCF\'s doctrine of Scripture (Chapter 1), what is meant by the "analogy of faith" as an interpretive principle?',
    options: [
      'Difficult or obscure passages are to be interpreted in light of clearer passages and the overall system of doctrine taught in Scripture',
      'Scripture must be interpreted in light of church tradition and the faith of the fathers',
      'Faith in God is necessary before any interpretation of Scripture is possible',
      'The analogy of faith refers to comparing the faith of Old Testament saints with New Testament believers',
    ],
    answer: 0,
  },
]

const TIERS = [
  { min: 0,  max: 10, label: 'Seeker',          color: 'var(--ink-muted)',  bg: 'var(--border)',      desc: 'You\'re exploring the Reformed faith. Many great theologians started right where you are. Keep reading!' },
  { min: 11, max: 18, label: 'Sympathizer',      color: 'var(--teal)',      bg: 'var(--teal-light)',  desc: 'You appreciate Reformed doctrine and are growing in understanding. The confessions await you.' },
  { min: 19, max: 25, label: 'Convinced',        color: 'var(--amber-ink)', bg: 'var(--amber-soft)',  desc: 'You hold Reformed convictions and understand the core doctrines. The Word and its implications are becoming clearer.' },
  { min: 26, max: 31, label: 'Confessional',     color: 'var(--purple-ink)',bg: 'var(--purple-soft)', desc: 'You are deeply grounded in confessional Reformed theology with solid historical awareness.' },
  { min: 32, max: 37, label: 'Particular Baptist', color: 'white',         bg: 'var(--ink)',          desc: 'Excellent! You demonstrate thorough knowledge of Particular Baptist theology, history, and confessional distinctives.' },
]

function getTier(score) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0]
}

function levelColor(level) {
  if (level === 'easy')         return { color: 'var(--teal)',       bg: 'var(--teal-light)' }
  if (level === 'medium')       return { color: 'var(--amber-ink)',  bg: 'var(--amber-soft)' }
  if (level === 'intermediate') return { color: 'var(--purple-ink)', bg: 'var(--purple-soft)' }
  if (level === 'advanced')     return { color: 'var(--ink)',        bg: 'var(--border)' }
  return { color: 'white', bg: 'var(--ink)' }
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function QuizPage() {
  const navigate = useNavigate()
  const [questions] = useState(() => shuffle(QUESTIONS))
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})   // { questionId: selectedIndex }
  const [submitted, setSubmitted] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showCorrect, setShowCorrect] = useState(false)

  const q = questions[current]
  const isAnswered = answers[q.id] !== undefined
  const isLast = current === questions.length - 1

  function choose(idx) {
    if (isAnswered) return
    setSelected(idx)
    setShowCorrect(true)
    setTimeout(() => {
      setAnswers(prev => ({ ...prev, [q.id]: idx }))
      setSelected(null)
      setShowCorrect(false)
      if (!isLast) {
        setCurrent(c => c + 1)
      }
    }, 900)
  }

  function finish() {
    setSubmitted(true)
  }

  const score = Object.entries(answers).reduce((sum, [id, ans]) => {
    const question = questions.find(q => q.id === parseInt(id))
    return sum + (question && question.answer === ans ? 1 : 0)
  }, 0)

  const tier = getTier(score)
  const lc = levelColor(q.level)

  if (submitted) {
    return <ResultsScreen score={score} total={questions.length} tier={tier} answers={answers} questions={questions} navigate={navigate} />
  }

  const progress = (current / questions.length) * 100

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.navInner}>
          <button onClick={() => navigate('/')} className="btn btn-ghost" style={{gap:6, fontSize:13}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Back
          </button>
          <span style={s.navTitle}>How Particular Baptist Are You?</span>
          <span style={s.navCount}>{current + 1} / {questions.length}</span>
        </div>
      </nav>

      {/* Progress bar */}
      <div style={s.progressTrack}>
        <div style={{...s.progressFill, width: `${progress}%`}} />
      </div>

      <div style={s.body}>
        <div style={s.card}>
          {/* Level + Category badge */}
          <div style={s.badgeRow}>
            <span style={{...s.levelBadge, color: lc.color, background: lc.bg}}>
              {q.level.charAt(0).toUpperCase() + q.level.slice(1)}
            </span>
            <span style={s.catBadge}>{q.category}</span>
          </div>

          {/* Question */}
          <p style={s.question}>{q.q}</p>

          {/* Options */}
          <div style={s.options}>
            {q.options.map((opt, i) => {
              let optStyle = { ...s.option }
              if (showCorrect) {
                if (i === q.answer) optStyle = { ...s.option, ...s.optionCorrect }
                else if (i === selected && i !== q.answer) optStyle = { ...s.option, ...s.optionWrong }
              }
              if (isAnswered) {
                if (i === q.answer) optStyle = { ...s.option, ...s.optionCorrect }
              }
              return (
                <button key={i} style={optStyle} onClick={() => choose(i)} disabled={isAnswered || showCorrect}>
                  <span style={s.optionLetter}>{String.fromCharCode(65 + i)}</span>
                  <span>{opt}</span>
                </button>
              )
            })}
          </div>

          {/* Next / Finish — only shown if this question is answered */}
          {isAnswered && (
            <div style={{textAlign:'right', marginTop:8}}>
              {isLast
                ? <button onClick={finish} className="btn btn-primary" style={{fontSize:14}}>See My Results →</button>
                : <button onClick={() => setCurrent(c => c + 1)} className="btn btn-primary" style={{fontSize:14}}>Next →</button>
              }
            </div>
          )}
        </div>

        {/* Quick nav dots */}
        <div style={s.dots}>
          {questions.map((_, i) => {
            const ans = answers[questions[i].id]
            const correct = ans !== undefined && questions[i].answer === ans
            const wrong   = ans !== undefined && questions[i].answer !== ans
            return (
              <div
                key={i}
                title={`Q${i+1}`}
                style={{
                  ...s.dot,
                  background: correct ? 'var(--teal)' : wrong ? '#e07070' : i === current ? 'var(--ink)' : 'var(--border-strong)',
                  transform: i === current ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ResultsScreen({ score, total, tier, answers, questions, navigate }) {
  const pct = Math.round((score / total) * 100)

  const categoryBreakdown = {}
  questions.forEach(q => {
    if (!categoryBreakdown[q.category]) categoryBreakdown[q.category] = { correct: 0, total: 0 }
    categoryBreakdown[q.category].total++
    if (answers[q.id] === q.answer) categoryBreakdown[q.category].correct++
  })

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <div style={s.navInner}>
          <button onClick={() => navigate('/')} className="btn btn-ghost" style={{gap:6, fontSize:13}}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Home
          </button>
          <span style={s.navTitle}>Your Results</span>
          <span />
        </div>
      </nav>

      <div style={s.resultsBody}>
        {/* Score hero */}
        <div style={s.scoreCard}>
          <img src="/pb-icon.svg" alt="P.B." style={{width:56,height:56,margin:'0 auto 1rem',display:'block'}} />
          <div style={{...s.tierLabel, color: tier.color, background: tier.bg}}>{tier.label}</div>
          <div style={s.scoreNum}>{score}<span style={s.scoreOf}> / {total}</span></div>
          <div style={s.scorePct}>{pct}% correct</div>
          <p style={s.tierDesc}>{tier.desc}</p>
        </div>

        {/* Category breakdown */}
        <div style={s.breakdownCard}>
          <div style={s.breakdownTitle}>Performance by Category</div>
          {Object.entries(categoryBreakdown).map(([cat, { correct, total: t }]) => (
            <div key={cat} style={s.breakdownRow}>
              <span style={s.breakdownCat}>{cat}</span>
              <div style={s.breakdownBar}>
                <div style={{...s.breakdownFill, width: `${(correct/t)*100}%`}} />
              </div>
              <span style={s.breakdownScore}>{correct}/{t}</span>
            </div>
          ))}
        </div>

        {/* Review */}
        <div style={s.reviewCard}>
          <div style={s.breakdownTitle}>Answer Review</div>
          {questions.map((q, i) => {
            const userAns = answers[q.id]
            const isCorrect = userAns === q.answer
            const lc = levelColor(q.level)
            return (
              <div key={q.id} style={{...s.reviewItem, borderColor: isCorrect ? 'var(--teal)' : '#e07070'}}>
                <div style={s.reviewMeta}>
                  <span style={{fontSize:12, fontWeight:600, color:'var(--ink-faint)'}}>Q{i+1}</span>
                  <span style={{...s.levelBadge, color:lc.color, background:lc.bg, fontSize:10}}>{q.level}</span>
                  <span style={{fontSize:11, color:'var(--ink-faint)'}}>{q.category}</span>
                </div>
                <p style={s.reviewQ}>{q.q}</p>
                {userAns !== q.answer && (
                  <p style={s.reviewYours}>Your answer: <em>{q.options[userAns]}</em></p>
                )}
                <p style={{...s.reviewCorrect, color: isCorrect ? 'var(--teal)' : '#c05050'}}>
                  {isCorrect ? '✓ ' : '✗ Correct: '}{isCorrect ? q.options[q.answer] : q.options[q.answer]}
                </p>
              </div>
            )
          })}
        </div>

        {/* CTAs */}
        <div style={s.resultCtas}>
          <button onClick={() => window.location.reload()} className="btn btn-outline" style={{fontSize:14}}>
            Retake the Quiz
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{fontSize:14}}>
            Begin the Devotional →
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Styles ─── */
const s = {
  page: { minHeight: '100vh', background: 'var(--parchment)', fontFamily: "'DM Sans', sans-serif" },

  nav: { borderBottom: '1px solid var(--border)', background: 'rgba(245,240,232,0.97)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 20 },
  navInner: { maxWidth: 760, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navTitle: { fontSize: 14, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: 'var(--ink)' },
  navCount: { fontSize: 13, color: 'var(--ink-muted)', fontWeight: 500 },

  progressTrack: { height: 3, background: 'var(--border)', position: 'sticky', top: 49, zIndex: 19 },
  progressFill: { height: '100%', background: 'var(--teal)', transition: 'width 0.4s ease' },

  body: { maxWidth: 640, margin: '0 auto', padding: '2.5rem 24px 4rem' },

  card: { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2rem', boxShadow: 'var(--shadow-sm)' },

  badgeRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.25rem' },
  levelBadge: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 10px', borderRadius: 99 },
  catBadge: { fontSize: 11, color: 'var(--ink-faint)', fontWeight: 500 },

  question: { fontSize: 18, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, color: 'var(--ink)', lineHeight: 1.55, marginBottom: '1.5rem' },

  options: { display: 'flex', flexDirection: 'column', gap: 10 },
  option: {
    display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left',
    padding: '12px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)',
    background: 'var(--parchment)', cursor: 'pointer', fontSize: 14, color: 'var(--ink)',
    lineHeight: 1.5, transition: 'border-color 0.15s, background 0.15s', fontFamily: "'DM Sans', sans-serif",
  },
  optionCorrect: { borderColor: 'var(--teal)', background: 'var(--teal-light)', color: 'var(--teal)' },
  optionWrong:   { borderColor: '#e07070', background: '#fff0f0', color: '#c05050' },
  optionLetter: { fontWeight: 700, fontSize: 13, minWidth: 20, paddingTop: 1, color: 'var(--ink-faint)' },

  dots: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: '2rem' },
  dot: { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.2s, transform 0.2s', cursor: 'default' },

  // Results
  resultsBody: { maxWidth: 640, margin: '0 auto', padding: '2.5rem 24px 5rem', display: 'flex', flexDirection: 'column', gap: 20 },
  scoreCard: { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '2.5rem 2rem', textAlign: 'center', boxShadow: 'var(--shadow-sm)' },
  tierLabel: { display: 'inline-block', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '5px 16px', borderRadius: 99, marginBottom: '1rem' },
  scoreNum: { fontSize: 56, fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: 'var(--ink)', lineHeight: 1 },
  scoreOf: { fontSize: 28, color: 'var(--ink-muted)' },
  scorePct: { fontSize: 14, color: 'var(--ink-faint)', marginTop: 4, marginBottom: '1rem' },
  tierDesc: { fontSize: 15, color: 'var(--ink-muted)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 0' },

  breakdownCard: { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' },
  breakdownTitle: { fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-faint)', marginBottom: '1rem' },
  breakdownRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  breakdownCat: { fontSize: 13, color: 'var(--ink)', fontWeight: 500, width: 130, flexShrink: 0 },
  breakdownBar: { flex: 1, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' },
  breakdownFill: { height: '100%', background: 'var(--teal)', borderRadius: 99 },
  breakdownScore: { fontSize: 12, color: 'var(--ink-faint)', width: 30, textAlign: 'right' },

  reviewCard: { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' },
  reviewItem: { borderLeft: '3px solid', paddingLeft: 14, marginBottom: 20 },
  reviewMeta: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  reviewQ: { fontSize: 14, fontWeight: 500, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.4 },
  reviewYours: { fontSize: 12, color: '#c05050', margin: '0 0 2px' },
  reviewCorrect: { fontSize: 13, fontWeight: 600, margin: 0 },

  resultCtas: { display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' },
}
