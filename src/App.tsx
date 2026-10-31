import { useState, useEffect, useCallback, useRef } from 'react';

type GamePhase = 'start' | 'countdown' | 'playing' | 'waitingForAI' | 'gameOver';
type ActionType = 'defend' | 'attack' | 'inhale';
type ThemeMode = 'dark' | 'light';
type Difficulty = 'easy' | 'medium' | 'hard';

interface Action {
  type: ActionType;
  level: number;
}

interface Player {
  name: string;
  qi: number;
  lastAction: Action | null;
}

interface LogEntry {
  text: string;
  type: 'info' | 'attack' | 'defend' | 'inhale' | 'death' | 'system';
}

interface BattleRecord {
  id: number;
  winner: string;
  loser: string;
  rounds: number;
  lastAction: string;
  timestamp: string;
}

interface Theme {
  // Page backgrounds
  pageBg: string;
  pageBgGameover: string;
  // Card backgrounds
  cardBg: string;
  cardBgAlt: string;
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Borders
  border: string;
  borderPlayer: string;
  borderOpponent: string;
  // Buttons
  btnBg: string;
  btnHover: string;
  btnActiveBg: string;
  // Log area
  logBg: string;
  // Header
  headerBg: string;
  // Action panel
  actionBg: string;
  // Records
  recordBg: string;
  // Inner card bg
  innerCardBg: string;
}

const darkTheme: Theme = {
  pageBg: 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900',
  pageBgGameover: 'bg-gradient-to-br from-gray-900 via-red-900/30 to-gray-900',
  cardBg: 'bg-gray-800/70',
  cardBgAlt: 'bg-gray-800/60',
  textPrimary: 'text-white',
  textSecondary: 'text-gray-300',
  textMuted: 'text-gray-400',
  border: 'border-gray-700',
  borderPlayer: 'border-blue-500/30',
  borderOpponent: 'border-red-500/30',
  btnBg: 'bg-gray-700',
  btnHover: 'hover:bg-gray-600',
  btnActiveBg: 'bg-gray-600',
  logBg: 'bg-black/60',
  headerBg: 'bg-black/30',
  actionBg: 'bg-black/50',
  recordBg: 'bg-gray-800/60',
  innerCardBg: 'bg-gray-900/50',
};

const lightTheme: Theme = {
  pageBg: 'bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50',
  pageBgGameover: 'bg-gradient-to-br from-blue-50 via-red-100 to-pink-50',
  cardBg: 'bg-white/80',
  cardBgAlt: 'bg-white/70',
  textPrimary: 'text-gray-900',
  textSecondary: 'text-gray-700',
  textMuted: 'text-gray-500',
  border: 'border-gray-300',
  borderPlayer: 'border-blue-400/50',
  borderOpponent: 'border-red-400/50',
  btnBg: 'bg-gray-200',
  btnHover: 'hover:bg-gray-300',
  btnActiveBg: 'bg-gray-300',
  logBg: 'bg-white/70',
  headerBg: 'bg-white/50',
  actionBg: 'bg-white/60',
  recordBg: 'bg-white/70',
  innerCardBg: 'bg-gray-100/80',
};

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const theme: Theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const [phase, setPhase] = useState<GamePhase>('start');
  const [countdown, setCountdown] = useState(3);
  const [round, setRound] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showQiInsufficient, setShowQiInsufficient] = useState(false);
  const [player, setPlayer] = useState<Player>({
    name: '玩家',
    qi: 0,
    lastAction: null,
  });
  const [opponent, setOpponent] = useState<Player>({
    name: '对手',
    qi: 0,
    lastAction: null,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [loser, setLoser] = useState<string | null>(null);
  const [deathMessage, setDeathMessage] = useState<string>('');
  const [showToast, setShowToast] = useState(false);
  const [battleRecords, setBattleRecords] = useState<BattleRecord[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // Countdown effect
  useEffect(() => {
    if (phase === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'countdown' && countdown === 0) {
      setPhase('playing');
      addLog('⚔️ 战斗开始！', 'system');
    }
  }, [phase, countdown]);

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { text, type }]);
  };

  const startGame = () => {
    setPhase('countdown');
    setCountdown(3);
    setRound(1);
    setPlayer({ name: '玩家', qi: 0, lastAction: null });
    setOpponent({ name: '对手', qi: 0, lastAction: null });
    setLogs([]);
    setWinner(null);
    setLoser(null);
    setDeathMessage('');
    setSelectedAction(null);
    setSelectedLevel(1);
  };

  // Calculate qi cost for action
  const getQiCost = (type: ActionType, level: number): number => {
    if (type === 'inhale') return 0;
    if (type === 'defend') return level - 1;
    if (type === 'attack') return level;
    return 0;
  };

  // Check if action is valid
  const isValidAction = (type: ActionType, level: number, qi: number): boolean => {
    if (type === 'defend' && level === 5) return false;
    return qi >= getQiCost(type, level);
  };

  // Get available levels for an action type
  const getAvailableLevels = (type: ActionType, qi: number): number[] => {
    const maxLevel = type === 'defend' ? 4 : 5;
    const levels: number[] = [];
    for (let i = 1; i <= maxLevel; i++) {
      if (isValidAction(type, i, qi)) {
        levels.push(i);
      }
    }
    return levels;
  };

  // AI opponent decision based on difficulty - much stronger AI
  const getAIAction = (ai: Player): Action => {
    const rand = Math.random();

    // If no qi, must inhale
    if (ai.qi === 0) {
      return { type: 'inhale', level: 1 };
    }

    // Difficulty-based strategy
    switch (difficulty) {
      case 'easy':
        // Easy: AI is still decent but makes more mistakes
        if (ai.qi >= 3 && rand < 0.6) {
          // Attack with high level
          const availableLevels = getAvailableLevels('attack', ai.qi);
          if (availableLevels.length > 0) {
            const levelIdx = Math.min(availableLevels.length - 1, Math.floor(availableLevels.length * 0.6));
            return { type: 'attack', level: availableLevels[levelIdx] };
          }
        } else if (ai.qi >= 2 && rand < 0.8) {
          // Defend
          const availableLevels = getAvailableLevels('defend', ai.qi);
          if (availableLevels.length > 0) {
            const levelIdx = Math.floor(availableLevels.length * 0.5);
            return { type: 'defend', level: availableLevels[levelIdx] };
          }
        }
        return { type: 'inhale', level: 1 };

      case 'medium':
        // Medium: AI is smart and aggressive
        if (ai.qi >= 4 && rand < 0.7) {
          // High level attack
          const availableLevels = getAvailableLevels('attack', ai.qi);
          if (availableLevels.length > 0) {
            const levelIdx = Math.min(availableLevels.length - 1, Math.floor(availableLevels.length * 0.8));
            return { type: 'attack', level: availableLevels[levelIdx] };
          }
        } else if (ai.qi >= 2 && rand < 0.85) {
          // Defend or attack
          if (rand < 0.5) {
            const availableLevels = getAvailableLevels('defend', ai.qi);
            if (availableLevels.length > 0) {
              const levelIdx = Math.floor(availableLevels.length * 0.7);
              return { type: 'defend', level: availableLevels[levelIdx] };
            }
          } else {
            const availableLevels = getAvailableLevels('attack', ai.qi);
            if (availableLevels.length > 0) {
              const levelIdx = Math.min(availableLevels.length - 1, Math.floor(availableLevels.length * 0.7));
              return { type: 'attack', level: availableLevels[levelIdx] };
            }
          }
        }
        return { type: 'inhale', level: 1 };

      case 'hard':
        // Hard: AI is very aggressive and strategic
        if (ai.qi >= 5) {
          // Always use highest attack
          const availableLevels = getAvailableLevels('attack', ai.qi);
          if (availableLevels.length > 0) {
            return { type: 'attack', level: availableLevels[availableLevels.length - 1] };
          }
        } else if (ai.qi >= 3 && rand < 0.85) {
          // High level attack
          const availableLevels = getAvailableLevels('attack', ai.qi);
          if (availableLevels.length > 0) {
            return { type: 'attack', level: availableLevels[availableLevels.length - 1] };
          }
        } else if (ai.qi >= 2 && rand < 0.9) {
          // Defend with high level
          const availableLevels = getAvailableLevels('defend', ai.qi);
          if (availableLevels.length > 0) {
            return { type: 'defend', level: availableLevels[availableLevels.length - 1] };
          }
        } else if (ai.qi >= 1) {
          // Attack with available level
          const availableLevels = getAvailableLevels('attack', ai.qi);
          if (availableLevels.length > 0) {
            return { type: 'attack', level: availableLevels[availableLevels.length - 1] };
          }
        }
        return { type: 'inhale', level: 1 };
    }

    return { type: 'inhale', level: 1 };
  };

  // Get defense level for an action
  const getDefenseLevel = (action: Action): number => {
    if (action.type === 'defend') return action.level;
    return 0;
  };

  // Resolve round
  const resolveRound = useCallback((playerAction: Action, aiAction: Action) => {
    // Player qi already updated in handleAction, only update opponent qi
    let newOpponentQi = opponent.qi;
    const newLogs: LogEntry[] = [];
    let playerDied = false;
    let opponentDied = false;
    let msg = '';

    if (aiAction.type === 'inhale') {
      newOpponentQi += 1;
    } else {
      newOpponentQi -= getQiCost(aiAction.type, aiAction.level);
    }

    const actionText = (who: string, action: Action) => {
      if (action.type === 'inhale') return `🌬️ ${who}吸了一口气！（气数+1）`;
      if (action.type === 'defend') return `🛡️ ${who}展开${action.level}级防御！`;
      return `⚡ ${who}发动${action.level}级攻击！`;
    };

    // Only log AI action (player action already logged)
    newLogs.push({ text: actionText(opponent.name, aiAction), type: aiAction.type === 'attack' ? 'attack' : aiAction.type === 'defend' ? 'defend' : 'inhale' });

    const playerAttacks = playerAction.type === 'attack';
    const aiAttacks = aiAction.type === 'attack';
    const playerDefends = getDefenseLevel(playerAction);
    const aiDefends = getDefenseLevel(aiAction);

    if (playerAttacks && aiAttacks) {
      if (playerAction.level > aiAction.level) {
        opponentDied = true;
        newLogs.push({ text: `💀 ${player.name}的${playerAction.level}级攻击压制了${opponent.name}的${aiAction.level}级攻击，${opponent.name}被击杀！`, type: 'death' });
        msg = `${playerAction.level}级攻击 > ${aiAction.level}级攻击，${opponent.name}被击杀！`;
      } else if (aiAction.level > playerAction.level) {
        playerDied = true;
        newLogs.push({ text: `💀 ${opponent.name}的${aiAction.level}级攻击压制了你的${playerAction.level}级攻击，你被击杀！`, type: 'death' });
        msg = `${aiAction.level}级攻击 > ${playerAction.level}级攻击，你被击杀！`;
      } else {
        newLogs.push({ text: `⚔️ 双方都出了${playerAction.level}级攻击，势均力敌，无事发生！`, type: 'info' });
      }
    } else if (playerAttacks && !aiAttacks) {
      if (playerAction.level > aiDefends) {
        opponentDied = true;
        if (aiAction.type === 'inhale') {
          newLogs.push({ text: `💀 ${opponent.name}正在吸气，毫无防备，被${playerAction.level}级攻击击杀！`, type: 'death' });
          msg = `${opponent.name}在吸气时被击杀！`;
        } else {
          newLogs.push({ text: `💀 ${opponent.name}的${aiAction.level}级防御无法抵挡${playerAction.level}级攻击，被击杀！`, type: 'death' });
          msg = `${playerAction.level}级攻击击破了${aiAction.level}级防御！`;
        }
      } else {
        newLogs.push({ text: `✅ ${opponent.name}的${aiDefends}级防御成功抵挡了${playerAction.level}级攻击！`, type: 'defend' });
      }
    } else if (!playerAttacks && aiAttacks) {
      if (aiAction.level > playerDefends) {
        playerDied = true;
        if (playerAction.type === 'inhale') {
          newLogs.push({ text: `💀 你正在吸气，毫无防备，被${aiAction.level}级攻击击杀！`, type: 'death' });
          msg = '你在吸气时被击杀！';
        } else {
          newLogs.push({ text: `💀 你的${playerAction.level}级防御无法抵挡${aiAction.level}级攻击，被击杀！`, type: 'death' });
          msg = `${aiAction.level}级攻击击破了你的${playerAction.level}级防御！`;
        }
      } else {
        newLogs.push({ text: `✅ 你的${playerDefends}级防御成功抵挡了${aiAction.level}级攻击！`, type: 'defend' });
      }
    }

    setOpponent(prev => ({
      ...prev,
      qi: newOpponentQi,
      lastAction: aiAction,
    }));

    setLogs(prev => [...prev, ...newLogs]);

    if (opponentDied) {
      setWinner(player.name);
      setLoser(opponent.name);
      setDeathMessage(msg);
      setPhase('gameOver');
      addBattleRecord(player.name, opponent.name, round, msg);
    } else if (playerDied) {
      setWinner(opponent.name);
      setLoser(player.name);
      setDeathMessage(msg);
      setPhase('gameOver');
      addBattleRecord(opponent.name, player.name, round, msg);
    } else {
      setLogs(prev => [...prev, { text: '📢 已进入下一回合', type: 'system' }]);
      setSelectedAction(null);
      setSelectedLevel(1);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1500);
      setRound(prev => prev + 1);
      setPhase('playing'); // Reset to playing phase for next round
    }

    return !playerDied && !opponentDied;
  }, [player, opponent, round]);

  const addBattleRecord = (winnerName: string, loserName: string, rounds: number, lastAction: string) => {
    const record: BattleRecord = {
      id: Date.now(),
      winner: winnerName,
      loser: loserName,
      rounds,
      lastAction,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
    setBattleRecords(prev => [record, ...prev].slice(0, 10));
  };

  const handleAction = (type: ActionType, level: number) => {
    if (isProcessing || (phase !== 'playing' && phase !== 'waitingForAI')) return;
    if (phase === 'waitingForAI') return; // Don't allow action while waiting for AI
    if (!isValidAction(type, level, player.qi)) return;

    setIsProcessing(true);
    const playerAction: Action = { type, level };

    addLog(`--- 第${round}回合 ---`, 'system');
    
    // Log player's action immediately
    const actionText = (who: string, action: Action) => {
      if (action.type === 'inhale') return `🌬️ ${who}吸了一口气！（气数+1）`;
      if (action.type === 'defend') return `🛡️ ${who}展开${action.level}级防御！`;
      return `⚡ ${who}发动${action.level}级攻击！`;
    };
    
    const logType = playerAction.type === 'attack' ? 'attack' : playerAction.type === 'defend' ? 'defend' : 'inhale';
    addLog(actionText(player.name, playerAction), logType);
    
    // Update player state immediately
    let newPlayerQi = player.qi;
    if (playerAction.type === 'inhale') {
      newPlayerQi += 1;
    } else {
      newPlayerQi -= getQiCost(playerAction.type, playerAction.level);
    }
    
    setPlayer(prev => ({
      ...prev,
      qi: newPlayerQi,
      lastAction: playerAction,
    }));
    
    // Set phase to waiting for AI
    setPhase('waitingForAI');

    // AI decides quickly after 0.05-0.1 seconds
    const delay = 50 + Math.random() * 50;
    setTimeout(() => {
      const aiAction = getAIAction(opponent);
      resolveRound(playerAction, aiAction);
      setIsProcessing(false);
    }, delay);
  };
  
  // Handle attack button click when qi is insufficient
  const handleAttackClick = () => {
    if (player.qi === 0) {
      setShowQiInsufficient(true);
      setTimeout(() => setShowQiInsufficient(false), 1500);
    } else {
      setSelectedAction('attack');
      setSelectedLevel(1);
    }
  };

  // Theme toggle button component
  const ThemeToggle = () => (
    <button
      onClick={() => setThemeMode(prev => prev === 'dark' ? 'light' : 'dark')}
      className={`fixed top-4 right-4 z-50 w-12 h-12 rounded-lg flex items-center justify-center transition-all transform hover:scale-110 active:scale-95 bg-transparent border-2 ${
        themeMode === 'dark'
          ? 'border-yellow-400 hover:border-yellow-300'
          : 'border-indigo-700 hover:border-indigo-900'
      }`}
      title={themeMode === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
    >
      <span className="text-2xl">
        {themeMode === 'dark' ? '☀️' : '🌙'}
      </span>
    </button>
  );

  // Start screen
  if (phase === 'start') {
    return (
      <div className={`min-h-screen ${theme.pageBg} flex flex-col transition-colors duration-500`}>
        <ThemeToggle />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <h1 className={`text-6xl font-bold ${theme.textPrimary} mb-4 animate-pulse text-center`}>
              拍手模拟器
            </h1>
            <p className={`${theme.textSecondary} text-lg mb-2`}>回合制战斗游戏 三鑫特色</p>
            
            {/* Difficulty Selection */}
            <div className="mb-6">
              <p className={`${theme.textSecondary} text-sm mb-3`}>选择难度：</p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setDifficulty('easy')}
                  className={`px-6 py-2 rounded-lg font-bold transition-all ${
                    difficulty === 'easy'
                      ? 'bg-green-600 text-white scale-105'
                      : `${theme.btnBg} ${theme.textSecondary} ${theme.btnHover}`
                  }`}
                >
                  低难度
                </button>
                <button
                  onClick={() => setDifficulty('medium')}
                  className={`px-6 py-2 rounded-lg font-bold transition-all ${
                    difficulty === 'medium'
                      ? 'bg-yellow-600 text-white scale-105'
                      : `${theme.btnBg} ${theme.textSecondary} ${theme.btnHover}`
                  }`}
                >
                  中难度
                </button>
                <button
                  onClick={() => setDifficulty('hard')}
                  className={`px-6 py-2 rounded-lg font-bold transition-all ${
                    difficulty === 'hard'
                      ? 'bg-red-600 text-white scale-105'
                      : `${theme.btnBg} ${theme.textSecondary} ${theme.btnHover}`
                  }`}
                >
                  高难度
                </button>
              </div>
              <p className={`${theme.textMuted} text-xs mt-2`}>
                {difficulty === 'easy' && '玩家胜率 3/5 · AI较保守'}
                {difficulty === 'medium' && '玩家胜率 2/5 · AI较激进'}
                {difficulty === 'hard' && '玩家胜率 1/5 · AI极强'}
              </p>
            </div>
            
            <div className={`${theme.textMuted} text-sm mb-8 max-w-md mx-auto text-left ${theme.cardBg} backdrop-blur-sm p-4 rounded-lg border ${theme.border}`}>
              <p className="mb-2">📜 <strong>游戏规则：</strong></p>
              <p className="mb-1">• 每回合选择：防御、攻击或吸气</p>
              <p className="mb-1">• 吸气：气数+1（但无防御力，相当于0级防御）</p>
              <p className="mb-1">• 防御：x级防御消耗(x-1)气，抵挡x级及以下攻击</p>
              <p className="mb-1">• 攻击：y级攻击消耗y气，击破低于y级的防御</p>
              <p className="mb-1">• 最高5级，5级只有攻击没有防御</p>
              <p className="mb-1">• 攻击 vs 攻击：等级高者获胜，相同则无事发生</p>
              <p className="mb-1">• 攻击 vs 防御：攻击等级 &gt; 防御等级，防御方死亡</p>
              <p>• 吸气时受到任何攻击都会死亡</p>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 transform hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
            >
              开始游戏
            </button>
          </div>
        </div>

        {/* Battle Records */}
        {battleRecords.length > 0 && (
          <div className={`${theme.actionBg} backdrop-blur-sm border-t ${theme.border} p-4`}>
            <h3 className="text-yellow-500 font-bold text-center mb-3">📋 对战记录</h3>
            <div className="max-w-lg mx-auto space-y-2 max-h-48 overflow-y-auto">
              {battleRecords.map((record) => (
                <div key={record.id} className={`${theme.recordBg} backdrop-blur-sm rounded-lg px-4 py-2 flex items-center justify-between text-sm border ${theme.border}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 font-bold">{record.winner}</span>
                    <span className={theme.textMuted}>胜</span>
                    <span className="text-red-500">{record.loser}</span>
                  </div>
                  <div className={`${theme.textMuted} text-xs`}>
                    {record.rounds}回合 · {record.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Countdown screen
  if (phase === 'countdown') {
    return (
      <div className={`min-h-screen ${theme.pageBg} flex items-center justify-center transition-colors duration-500`}>
        <ThemeToggle />
        <div className="text-center">
          <p className={`${theme.textSecondary} text-2xl mb-4`}>准备战斗...</p>
          <div className={`text-9xl font-bold ${theme.textPrimary} animate-bounce`}>
            {countdown}
          </div>
        </div>
      </div>
    );
  }

  // Game Over screen
  if (phase === 'gameOver') {
    return (
      <div className={`min-h-screen ${theme.pageBgGameover} flex items-center justify-center transition-colors duration-500`}>
        <ThemeToggle />
        <div className="text-center p-8">
          <div className="text-6xl mb-6">
            {winner === player.name ? '🎉' : '💀'}
          </div>
          <h1 className={`text-4xl font-bold ${theme.textPrimary} mb-4`}>
            {winner === player.name ? '你获胜了！' : '你被击败了！'}
          </h1>
          <p className="text-xl text-yellow-500 mb-2">{deathMessage}</p>
          <p className={`${theme.textMuted} mb-8`}>共进行了 {round} 回合</p>
          <button
            onClick={() => setPhase('start')}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 transform hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
          >
            返回主界面
          </button>
        </div>
      </div>
    );
  }

  // Playing phase
  const defendLevels = getAvailableLevels('defend', player.qi);
  const attackLevels = getAvailableLevels('attack', player.qi);

  return (
    <div className={`min-h-screen ${theme.pageBg} flex flex-col transition-colors duration-500`}>
      <ThemeToggle />

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-xl px-8 py-4 rounded-2xl shadow-2xl shadow-yellow-500/50">
            📢 已进入下一回合
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`text-center py-3 ${theme.headerBg} backdrop-blur-sm`}>
        <h1 className={`text-2xl font-bold ${theme.textPrimary} text-center`}>拍手模拟器</h1>
        <p className={`${theme.textMuted} text-sm`}>第 {round} 回合</p>
      </div>

      {/* Battle Area */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 p-4">
        {/* Player */}
        <div className={`${theme.cardBg} backdrop-blur-sm rounded-2xl p-5 w-full max-w-xs border ${theme.borderPlayer}`}>
          <div className="text-center mb-3">
            <span className="text-4xl">🧑</span>
            <h2 className={`${theme.textPrimary} font-bold text-lg`}>{player.name}</h2>
          </div>
          <div className="space-y-2">
            <div>
              <div className={`flex justify-between text-sm ${theme.textSecondary} mb-1`}>
                <span>💨 气数</span>
                <span className="text-cyan-500 font-bold">{player.qi}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: Math.min(player.qi, 10) }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
                {player.qi === 0 && <span className={theme.textMuted + ' text-xs'}>无气</span>}
                {player.qi > 10 && <span className="text-cyan-500 text-xs">+{player.qi - 10}</span>}
              </div>
            </div>
            {player.lastAction && (
              <div className={`${theme.textMuted} text-xs mt-2 ${theme.innerCardBg} rounded p-2`}>
                上回合: {player.lastAction.type === 'attack' ? `⚡攻击 Lv.${player.lastAction.level}` : player.lastAction.type === 'defend' ? `🛡️防御 Lv.${player.lastAction.level}` : '🌬️吸气'}
              </div>
            )}
          </div>
        </div>

        {/* VS */}
        <div className="text-4xl font-bold text-yellow-400 animate-pulse">VS</div>

        {/* Opponent */}
        <div className={`${theme.cardBg} backdrop-blur-sm rounded-2xl p-5 w-full max-w-xs border ${theme.borderOpponent}`}>
          <div className="text-center mb-3">
            <span className="text-4xl">👹</span>
            <h2 className={`${theme.textPrimary} font-bold text-lg`}>{opponent.name}</h2>
          </div>
          <div className="space-y-2">
            <div>
              <div className={`flex justify-between text-sm ${theme.textSecondary} mb-1`}>
                <span>💨 气数</span>
                <span className="text-orange-500 font-bold">{opponent.qi}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: Math.min(opponent.qi, 10) }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
                {opponent.qi === 0 && <span className={theme.textMuted + ' text-xs'}>无气</span>}
                {opponent.qi > 10 && <span className="text-orange-500 text-xs">+{opponent.qi - 10}</span>}
              </div>
            </div>
            {opponent.lastAction && (
              <div className={`${theme.textMuted} text-xs mt-2 ${theme.innerCardBg} rounded p-2`}>
                上回合: {opponent.lastAction.type === 'attack' ? `⚡攻击 Lv.${opponent.lastAction.level}` : opponent.lastAction.type === 'defend' ? `🛡️防御 Lv.${opponent.lastAction.level}` : '🌬️吸气'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Panel */}
      <div className={`${theme.actionBg} backdrop-blur-sm border-t ${theme.border} p-4`}>
        {/* Action type selection */}
        <div className="flex justify-center gap-3 mb-3">
          <button
            onClick={() => { setSelectedAction('defend'); setSelectedLevel(1); }}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              selectedAction === 'defend'
                ? 'bg-blue-600 text-white scale-105'
                : `${theme.btnBg} ${theme.textSecondary} ${theme.btnHover}`
            } disabled:opacity-50`}
          >
            🛡️ 防御
          </button>
          <button
            onClick={handleAttackClick}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              selectedAction === 'attack'
                ? 'bg-red-600 text-white scale-105'
                : `${theme.btnBg} ${theme.textSecondary} ${theme.btnHover}`
            } disabled:opacity-50`}
          >
            ⚡ 攻击
          </button>
          <button
            onClick={() => { setSelectedAction('inhale'); setSelectedLevel(1); }}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              selectedAction === 'inhale'
                ? 'bg-green-600 text-white scale-105'
                : `${theme.btnBg} ${theme.textSecondary} ${theme.btnHover}`
            } disabled:opacity-50`}
          >
            🌬️ 吸气
          </button>
        </div>

        {/* Level selection and execute */}
        {selectedAction && (
          <div className="flex flex-wrap justify-center gap-2 mb-3">
            {selectedAction === 'inhale' ? (
              <button
                onClick={() => handleAction('inhale', 1)}
                disabled={isProcessing}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🌬️ 吸气（气数+1，无防御）
              </button>
            ) : selectedAction === 'defend' ? (
              defendLevels.map(level => (
                <button
                  key={level}
                  onClick={() => handleAction('defend', level)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-gradient-to-r from-blue-700 to-blue-600 text-white font-bold rounded-lg hover:from-blue-600 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🛡️ {level}级防御
                  <span className="text-xs ml-1 opacity-75">（{getQiCost('defend', level)}气）</span>
                </button>
              ))
            ) : (
              attackLevels.map(level => (
                <button
                  key={level}
                  onClick={() => handleAction('attack', level)}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-gradient-to-r from-red-700 to-red-600 text-white font-bold rounded-lg hover:from-red-600 hover:to-red-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⚡ {level}级攻击
                  <span className="text-xs ml-1 opacity-75">（{getQiCost('attack', level)}气）</span>
                </button>
              ))
            )}
          </div>
        )}

        {phase === 'waitingForAI' && (
          <div className="text-center text-yellow-500 text-sm">
            ⚡ 对手出招中...
          </div>
        )}
        
        {showQiInsufficient && (
          <div className="text-center text-red-500 font-bold animate-pulse mt-2">
            ⚠️ 气数不足
          </div>
        )}
      </div>

      {/* Battle Log */}
      <div className={`${theme.logBg} backdrop-blur-sm border-t ${theme.border} p-3 max-h-40 overflow-y-auto`} ref={logRef}>
        <div className="space-y-1">
          {logs.length === 0 && (
            <p className={`${theme.textMuted} text-sm text-center`}>战斗日志将在此显示...</p>
          )}
          {logs.map((log, i) => (
            <p key={i} className={`text-sm ${
              log.type === 'attack' ? 'text-red-500' :
              log.type === 'defend' ? 'text-blue-500' :
              log.type === 'inhale' ? 'text-green-500' :
              log.type === 'death' ? 'text-purple-500 font-bold' :
              log.type === 'system' ? 'text-yellow-500 font-bold' :
              theme.textMuted
            }`}>{log.text}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
