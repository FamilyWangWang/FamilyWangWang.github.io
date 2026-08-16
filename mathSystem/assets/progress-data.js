/* 数学版图 · 进度表数据 —— Atlas der Mathematik · Fortschrittsdaten
   全景表里的每一个知识点，中德文一一配对写在这里。
   中文版和德语版读的是同一份数据，所以两边条目数永远相同，不会漂移。
   条目 id 由「主线 + 海拔 + 序号」生成，跟语言无关：换语言不丢进度。 */
window.ATLAS_DATA = [
  {
    id: 's1', zh: '一 · 数与数系', de: '1 · Zahlen',
    zhSub: 'Zahlen', deSub: 'Zahlbereiche',
    zhHref: 'strand-1-numbers.html', deHref: 'strang-1-zahlen.html',
    tiers: [
      [
        ['自然数与位值制', 'Natürliche Zahlen und Stellenwertsystem'],
        ['四则运算的多重意义', 'Die vielen Bedeutungen der Grundrechenarten'],
        ['负数', 'Negative Zahlen'],
        ['分数与小数', 'Brüche und Dezimalzahlen'],
        ['素数与整除', 'Primzahlen und Teilbarkeit']
      ], [
        ['无理数与实数轴', 'Irrationale Zahlen und Zahlengerade'],
        ['幂、根、对数三兄弟', 'Potenz, Wurzel, Logarithmus als Dreigespann'],
        ['科学记数法与误差', 'Zehnerpotenzen und Fehler'],
        ['复数（选修）', 'Komplexe Zahlen (optional)'],
        ['数列的第一瞥', 'Erster Blick auf Folgen']
      ], [
        ['可数与不可数', 'Abzählbar und überabzählbar'],
        ['实数的严格构造', 'Strenge Konstruktion der reellen Zahlen'],
        ['代数数与超越数', 'Algebraische und transzendente Zahlen'],
        ['数论与 RSA 加密', 'Zahlentheorie und RSA'],
        ['p-进数', 'p-adische Zahlen']
      ]
    ]
  },
  {
    id: 's2', zh: '二 · 代数与结构', de: '2 · Algebra',
    zhSub: 'Algebra', deSub: 'Struktur',
    zhHref: 'strand-2-algebra.html', deHref: 'strang-2-algebra.html',
    tiers: [
      [
        ['字母代替数', 'Buchstaben statt Zahlen'],
        ['化简与合并同类项', 'Terme vereinfachen und zusammenfassen'],
        ['一元一次方程', 'Lineare Gleichungen'],
        ['二项公式', 'Binomische Formeln'],
        ['不等式', 'Ungleichungen']
      ], [
        ['二次方程与判别式', 'Quadratische Gleichungen und Diskriminante'],
        ['因式分解', 'Faktorisieren'],
        ['多项式与零点', 'Polynome und Nullstellen'],
        ['线性方程组与高斯消元', 'Lineare Gleichungssysteme und Gauß-Verfahren'],
        ['矩阵入门', 'Einstieg in Matrizen']
      ], [
        ['群、环、域', 'Gruppen, Ringe, Körper'],
        ['伽罗瓦理论（五次方程为何无公式）', 'Galois-Theorie (warum es für Grad fünf keine Formel gibt)'],
        ['线性代数 I/II', 'Lineare Algebra I/II'],
        ['抽象代数', 'Abstrakte Algebra']
      ]
    ]
  },
  {
    id: 's3', zh: '三 · 形与空间', de: '3 · Form & Raum',
    zhSub: 'Geometrie', deSub: 'Geometrie',
    zhHref: 'strand-3-geometry.html', deHref: 'strang-3-geometrie.html',
    tiers: [
      [
        ['角与平行线', 'Winkel und Parallelen'],
        ['三角形的构造与全等', 'Dreieckskonstruktion und Kongruenz'],
        ['圆的基本量', 'Grundgrößen am Kreis'],
        ['面积与体积', 'Flächen und Volumina'],
        ['对称与变换', 'Symmetrie und Abbildungen']
      ], [
        ['勾股定理家族', 'Die Pythagoras-Familie'],
        ['相似与射线定理', 'Ähnlichkeit und Strahlensätze'],
        ['三角学与单位圆', 'Trigonometrie und Einheitskreis'],
        ['正弦定理与余弦定理', 'Sinus- und Kosinussatz'],
        ['向量、直线与平面、点积叉积', 'Vektoren, Geraden und Ebenen, Skalar- und Kreuzprodukt']
      ], [
        ['非欧几何', 'Nichteuklidische Geometrie'],
        ['拓扑与欧拉公式', 'Topologie und Eulerscher Polyedersatz'],
        ['微分几何', 'Differentialgeometrie'],
        ['射影几何', 'Projektive Geometrie'],
        ['分形与维数', 'Fraktale und Dimension']
      ]
    ]
  },
  {
    id: 's4', zh: '四 · 函数与变化', de: '4 · Funktionen',
    zhSub: 'Analysis', deSub: 'Analysis',
    zhHref: 'strand-4-analysis.html', deHref: 'strang-4-analysis.html',
    tiers: [
      [
        ['正比与反比', 'Proportional und antiproportional'],
        ['坐标系', 'Koordinatensystem'],
        ['一次函数与斜率', 'Lineare Funktionen und Steigung'],
        ['从表格到图像', 'Von der Tabelle zum Graphen']
      ], [
        ['函数动物园（幂、指、对、三角、有理式）', 'Der Funktionen-Zoo (Potenz, Exponential, Logarithmus, Trigonometrie, gebrochenrational)'],
        ['平移伸缩的家族规律', 'Verschieben und Strecken als Familienregel'],
        ['极限直觉', 'Grenzwert-Intuition'],
        ['导数与曲线讨论', 'Ableitung und Kurvendiskussion'],
        ['积分与微积分基本定理', 'Integral und Hauptsatz'],
        ['增长与衰减模型', 'Wachstums- und Zerfallsmodelle']
      ], [
        ['ε-δ 严格化', 'ε-δ-Strenge'],
        ['多元微积分', 'Mehrdimensionale Analysis'],
        ['级数与泰勒展开', 'Reihen und Taylorentwicklung'],
        ['傅里叶分析', 'Fourier-Analysis'],
        ['复分析', 'Funktionentheorie'],
        ['微分方程', 'Differentialgleichungen']
      ]
    ]
  },
  {
    id: 's5', zh: '五 · 概率与统计', de: '5 · Stochastik',
    zhSub: 'Stochastik', deSub: 'Zufall & Daten',
    zhHref: 'strand-5-stochastics.html', deHref: 'strang-5-stochastik.html',
    tiers: [
      [
        ['平均数、中位数与离散程度', 'Mittelwert, Median, Streuung'],
        ['相对频率', 'Relative Häufigkeit'],
        ['树形图与路径法则', 'Baumdiagramm und Pfadregeln'],
        ['简单古典概型', 'Einfache Laplace-Experimente']
      ], [
        ['组合计数与二项系数', 'Kombinatorik und Binomialkoeffizienten'],
        ['条件概率与贝叶斯', 'Bedingte Wahrscheinlichkeit und Bayes'],
        ['随机变量、期望与方差', 'Zufallsvariable, Erwartungswert, Varianz'],
        ['二项分布与正态分布', 'Binomial- und Normalverteilung'],
        ['假设检验与两类错误', 'Hypothesentest und die beiden Fehlerarten']
      ], [
        ['大数定律与中心极限定理', 'Gesetz der großen Zahlen und zentraler Grenzwertsatz'],
        ['随机过程', 'Stochastische Prozesse'],
        ['贝叶斯统计', 'Bayes-Statistik'],
        ['统计学习与机器学习', 'Statistisches Lernen und maschinelles Lernen']
      ]
    ]
  },
  {
    id: 's6', zh: '六 · 离散与算法', de: '6 · Diskretes',
    zhSub: 'Diskrete Math.', deSub: 'Algorithmen',
    zhHref: 'strand-6-discrete.html', deHref: 'strang-6-diskret.html',
    tiers: [
      [
        ['数列与规律', 'Folgen und Muster'],
        ['真与假的判断', 'Wahr oder falsch entscheiden'],
        ['二进制与其他进制', 'Dual- und andere Stellenwertsysteme'],
        ['简单计数', 'Einfaches Abzählen']
      ], [
        ['递推与数学归纳法', 'Rekursion und vollständige Induktion'],
        ['图论入门（七桥问题、最短路）', 'Einstieg in die Graphentheorie (Königsberger Brücken, kürzeste Wege)'],
        ['鸽笼原理', 'Schubfachprinzip'],
        ['数值方法（牛顿法、数值积分）', 'Numerische Verfahren (Newton, numerische Integration)'],
        ['算法的步数感', 'Gefühl für Schrittzahlen']
      ], [
        ['复杂度与 P 对 NP', 'Komplexität und P gegen NP'],
        ['密码学', 'Kryptographie'],
        ['编码与纠错', 'Codierung und Fehlerkorrektur'],
        ['组合优化', 'Kombinatorische Optimierung'],
        ['计算理论', 'Berechenbarkeitstheorie']
      ]
    ]
  },
  {
    id: 's7', zh: '七 · 建模与应用', de: '7 · Modellieren',
    zhSub: 'Modellieren', deSub: 'Anwendung',
    zhHref: 'strand-7-modelling.html', deHref: 'strang-7-modellieren.html',
    tiers: [
      [
        ['百分比与利息', 'Prozent und Zinsen'],
        ['单位换算与量纲', 'Einheiten und Größen'],
        ['数量级估算', 'Größenordnungen abschätzen'],
        ['比例尺', 'Maßstab']
      ], [
        ['建模五步循环', 'Der Modellierungskreislauf'],
        ['复利与指数增长', 'Zinseszins und exponentielles Wachstum'],
        ['物理里的数学', 'Mathematik in der Physik'],
        ['图表如何骗人', 'Wie Diagramme täuschen']
      ], [
        ['运筹学与最优化', 'Operations Research und Optimierung'],
        ['数理金融', 'Finanzmathematik'],
        ['数据科学', 'Data Science'],
        ['数学建模竞赛', 'Modellierungswettbewerbe']
      ]
    ]
  },
  {
    id: 's0', zh: '零 · 数学的语言', de: '0 · Sprache',
    zhSub: '贯穿全书', deSub: 'durchgehend',
    zhHref: 'strand-0-language.html', deHref: 'strang-0-sprache.html',
    bedrock: true,
    tiers: [
      [
        ['集合与元素', 'Mengen und Elemente'],
        ['一句话是真是假', 'Ist ein Satz wahr oder falsch'],
        ['「所有」和「存在」', '«Für alle» und «es existiert»'],
        ['「当且仅当」', '«Genau dann, wenn»'],
        ['举一个反例', 'Ein Gegenbeispiel finden']
      ], [
        ['定义、公理、定理各干什么', 'Was Definition, Axiom und Satz jeweils tun'],
        ['直接证明', 'Direkter Beweis'],
        ['反证法', 'Widerspruchsbeweis'],
        ['数学归纳法', 'Vollständige Induktion'],
        ['充分与必要', 'Hinreichend und notwendig'],
        ['逆否命题', 'Kontraposition']
      ], [
        ['数理逻辑', 'Mathematische Logik'],
        ['集合论与选择公理', 'Mengenlehre und Auswahlaxiom'],
        ['哥德尔不完备定理', 'Gödels Unvollständigkeitssätze'],
        ['计算机辅助证明（Lean、Coq）', 'Computergestützte Beweise (Lean, Coq)']
      ]
    ]
  }
];
