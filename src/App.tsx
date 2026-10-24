import { useState, useEffect, useCallback, useRef } from 'react';

type GamePhase = 'start' | 'countdown' | 'playing' | 'roundResult' | 'gameOver';
type ActionType = 'defend' | 'attack' | 'inhale';

interface Action {
  type: ActionType;
  level: number;
}

interface Player {
  name: string;
  hp: number;
  maxHp: number;
  qi: number;
  lastAction: Action | null;
  shieldLevel: number; // current active shield
}

interface LogEntry {
  text: string;
  type: 'info' | 'attack' | 'defend' | 'inhale' | 'damage' | 'system';
}

function App() {
  const [phase, setPhase] = useState<GamePhase>('start');
  const [countdown, setCountdown] = useState(3);
  const [round, setRound] = useState(1);
  const [player, setPlayer] = useState<Player>({
    name: '玩家',
    hp: 20,
    maxHp: 20,
    qi: 0,
    lastAction: null,
    shieldLevel: 0,
  });
  const [opponent, setOpponent] = useState<Player>({
    name: '对手',
    hp: 20,
    maxHp: 20,
    qi: 0,
    lastAction: null,
    shieldLevel: 0,
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
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
    setPlayer({
      name: '玩家',
      hp: 20,
      maxHp: 20,
      qi: 0,
      lastAction: null,
      shieldLevel: 0,
    });
    setOpponent({
      name: '对手',
      hp: 20,
      maxHp: 20,
      qi: 0,
      lastAction: null,
      shieldLevel: 0,
    });
    setLogs([]);
    setWinner(null);
    setSelectedAction(null);
    setSelectedLevel(1);
  };

  // Calculate qi cost for action
  const getQiCost = (type: ActionType, level: number): number => {
    if (type === 'inhale') return 0;
    if (type === 'defend') return level - 1; // Level 1 = 0, Level 2 = 1, etc.
    if (type === 'attack') return level; // Level 1 = 1, Level 2 = 2, etc.
    return 0;
  };

  // Check if action is valid
  const isValidAction = (type: ActionType, level: number, qi: number): boolean => {
    if (type === 'defend' && level === 5) return false; // No level 5 defense
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

  // AI opponent decision
  const getAIAction = (ai: Player): Action => {
    const rand = Math.random();
    
    // Simple AI strategy
    if (ai.qi === 0 || (ai.qi <= 1 && rand < 0.4)) {
      return { type: 'inhale', level: 1 };
    }
    
    if (rand < 0.35) {
      // Attack
      const availableLevels = getAvailableLevels('attack', ai.qi);
      if (availableLevels.length > 0) {
        // Prefer higher level attacks when possible
        const levelIdx = Math.min(
          Math.floor(Math.random() * availableLevels.length),
          availableLevels.length - 1
        );
        return { type: 'attack', level: availableLevels[levelIdx] };
      }
    } else if (rand < 0.6) {
      // Defend
      const availableLevels = getAvailableLevels('defend', ai.qi);
      if (availableLevels.length > 0) {
        const levelIdx = Math.floor(Math.random() * availableLevels.length);
        return { type: 'defend', level: availableLevels[levelIdx] };
      }
    }
    
    // Default: inhale
    return { type: 'inhale', level: 1 };
  };

  // Resolve round
  const resolveRound = useCallback((playerAction: Action, aiAction: Action) => {
    let newPlayerHp = player.hp;
    let newOpponentHp = opponent.hp;
    let newPlayerQi = player.qi;
    let newOpponentQi = opponent.qi;
    let newPlayerShield = 0;
    let newOpponentShield = 0;
    const newLogs: LogEntry[] = [];

    // Process player action
    if (playerAction.type === 'inhale') {
      newPlayerQi += 1;
      newLogs.push({ text: `🌬️ ${player.name}吸了一口气！气数+1（当前：${newPlayerQi}）`, type: 'inhale' });
    } else if (playerAction.type === 'defend') {
      const cost = getQiCost('defend', playerAction.level);
      newPlayerQi -= cost;
      newPlayerShield = playerAction.level;
      newLogs.push({ text: `🛡️ ${player.name}展开${playerAction.level}级防御！（消耗${cost}气）`, type: 'defend' });
    } else if (playerAction.type === 'attack') {
      const cost = getQiCost('attack', playerAction.level);
      newPlayerQi -= cost;
      const damage = playerAction.level;
      // Check if opponent has shield
      if (opponent.shieldLevel > 0) {
        const blocked = Math.min(damage, opponent.shieldLevel);
        const actualDamage = damage - blocked;
        newOpponentHp -= actualDamage;
        if (blocked > 0) {
          newLogs.push({ text: `⚡ ${player.name}发动${playerAction.level}级攻击！对手${opponent.shieldLevel}级防御挡住了${blocked}点，造成${actualDamage}点伤害！`, type: 'attack' });
        } else {
          newLogs.push({ text: `⚡ ${player.name}发动${playerAction.level}级攻击！造成${damage}点伤害！`, type: 'attack' });
        }
      } else {
        newOpponentHp -= damage;
        newLogs.push({ text: `⚡ ${player.name}发动${playerAction.level}级攻击！造成${damage}点伤害！`, type: 'attack' });
      }
    }

    // Process AI action
    if (aiAction.type === 'inhale') {
      newOpponentQi += 1;
      newLogs.push({ text: `🌬️ ${opponent.name}吸了一口气！气数+1（当前：${newOpponentQi}）`, type: 'inhale' });
    } else if (aiAction.type === 'defend') {
      const cost = getQiCost('defend', aiAction.level);
      newOpponentQi -= cost;
      newOpponentShield = aiAction.level;
      newLogs.push({ text: `🛡️ ${opponent.name}展开${aiAction.level}级防御！（消耗${cost}气）`, type: 'defend' });
    } else if (aiAction.type === 'attack') {
      const cost = getQiCost('attack', aiAction.level);
      newOpponentQi -= cost;
      const damage = aiAction.level;
      // Check if player has shield
      if (player.shieldLevel > 0) {
        const blocked = Math.min(damage, player.shieldLevel);
        const actualDamage = damage - blocked;
        newPlayerHp -= actualDamage;
        if (blocked > 0) {
          newLogs.push({ text: `💥 ${opponent.name}发动${aiAction.level}级攻击！你的${player.shieldLevel}级防御挡住了${blocked}点，受到${actualDamage}点伤害！`, type: 'damage' });
        } else {
          newLogs.push({ text: `💥 ${opponent.name}发动${aiAction.level}级攻击！你受到${damage}点伤害！`, type: 'damage' });
        }
      } else {
        newPlayerHp -= damage;
        newLogs.push({ text: `💥 ${opponent.name}发动${aiAction.level}级攻击！你受到${damage}点伤害！`, type: 'damage' });
      }
    }

    // Clamp HP
    newPlayerHp = Math.max(0, newPlayerHp);
    newOpponentHp = Math.max(0, newOpponentHp);

    // Update states
    setPlayer(prev => ({
      ...prev,
      hp: newPlayerHp,
      qi: newPlayerQi,
      lastAction: playerAction,
      shieldLevel: newPlayerShield,
    }));
    setOpponent(prev => ({
      ...prev,
      hp: newOpponentHp,
      qi: newOpponentQi,
      lastAction: aiAction,
      shieldLevel: newOpponentShield,
    }));

    setLogs(prev => [...prev, ...newLogs]);

    // Check game over
    if (newPlayerHp <= 0 && newOpponentHp <= 0) {
      setLogs(prev => [...prev, { text: '💀 双方同归于尽！平局！', type: 'system' }]);
      setWinner('平局');
      setPhase('gameOver');
    } else if (newPlayerHp <= 0) {
      setLogs(prev => [...prev, { text: '💀 你被击败了...', type: 'system' }]);
      setWinner(opponent.name);
      setPhase('gameOver');
    } else if (newOpponentHp <= 0) {
      setLogs(prev => [...prev, { text: '🎉 你获胜了！', type: 'system' }]);
      setWinner(player.name);
      setPhase('gameOver');
    } else {
      // Round continues - reset buttons and show next round message
      setLogs(prev => [...prev, { text: '📢 已进入下一回合', type: 'system' }]);
      setSelectedAction(null);
      setSelectedLevel(1);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1500);
    }

    return newPlayerHp > 0 && newOpponentHp > 0;
  }, [player, opponent]);

  // Handle player action
  const handleAction = (type: ActionType, level: number) => {
    if (isProcessing || phase !== 'playing') return;
    if (!isValidAction(type, level, player.qi)) return;

    setIsProcessing(true);
    const playerAction: Action = { type, level };
    const aiAction = getAIAction(opponent);

    addLog(`--- 第${round}回合 ---`, 'system');

    // Random delay 0.3-0.5s
    const delay = 300 + Math.random() * 200;
    setTimeout(() => {
      const continueGame = resolveRound(playerAction, aiAction);
      if (continueGame) {
        setRound(prev => prev + 1);
      }
      setIsProcessing(false);
    }, delay);
  };

  // Render HP bar
  const HpBar = ({ current, max, color }: { current: number; max: number; color: string }) => (
    <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
      <div
        className={`h-full transition-all duration-500 ${color}`}
        style={{ width: `${(current / max) * 100}%` }}
      />
    </div>
  );

  // Start screen
  if (phase === 'start') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-6xl font-bold text-white mb-4 animate-pulse">
            ⚔️ 气功对决
          </h1>
          <p className="text-gray-300 text-lg mb-2">回合制战斗游戏</p>
          <div className="text-gray-400 text-sm mb-8 max-w-md mx-auto text-left bg-gray-800/50 p-4 rounded-lg">
            <p className="mb-2">📜 <strong>游戏规则：</strong></p>
            <p className="mb-1">• 每回合选择：防御、攻击或吸气</p>
            <p className="mb-1">• 吸气：气数+1</p>
            <p className="mb-1">• 防御：x级防御消耗(x-1)气，抵挡x点伤害</p>
            <p className="mb-1">• 攻击：y级攻击消耗y气，造成y点伤害</p>
            <p className="mb-1">• 最高5级，5级只有攻击没有防御</p>
            <p>• 先将对手HP降为0者获胜</p>
          </div>
          <button
            onClick={startGame}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 transform hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
          >
            开始游戏
          </button>
        </div>
      </div>
    );
  }

  // Countdown screen
  if (phase === 'countdown') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-300 text-2xl mb-4">准备战斗...</p>
          <div className="text-9xl font-bold text-white animate-bounce">
            {countdown}
          </div>
        </div>
      </div>
    );
  }

  // Game Over screen
  if (phase === 'gameOver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-5xl font-bold text-white mb-4">
            {winner === player.name ? '🎉 胜利！' : winner === '平局' ? '🤝 平局！' : '💀 失败...'}
          </h1>
          <p className="text-gray-300 text-xl mb-2">
            {winner === player.name
              ? '恭喜你击败了对手！'
              : winner === '平局'
              ? '双方同归于尽！'
              : '你被对手击败了...'}
          </p>
          <p className="text-gray-400 mb-8">共进行了 {round} 回合</p>
          <div className="mb-8 max-h-48 overflow-y-auto bg-gray-800/50 rounded-lg p-4" ref={logRef}>
            {logs.map((log, i) => (
              <p key={i} className={`text-sm ${
                log.type === 'attack' ? 'text-red-400' :
                log.type === 'defend' ? 'text-blue-400' :
                log.type === 'inhale' ? 'text-green-400' :
                log.type === 'damage' ? 'text-orange-400' :
                log.type === 'system' ? 'text-yellow-300 font-bold' :
                'text-gray-300'
              }`}>{log.text}</p>
            ))}
          </div>
          <button
            onClick={startGame}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xl font-bold rounded-xl hover:from-purple-500 hover:to-pink-500 transform hover:scale-105 transition-all shadow-lg shadow-purple-500/30"
          >
            再来一局
          </button>
        </div>
      </div>
    );
  }

  // Playing phase
  const defendLevels = getAvailableLevels('defend', player.qi);
  const attackLevels = getAvailableLevels('attack', player.qi);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
      {/* Header */}
      <div className="text-center py-3 bg-black/30">
        <h1 className="text-2xl font-bold text-white">⚔️ 气功对决</h1>
        <p className="text-gray-400 text-sm">第 {round} 回合</p>
      </div>

      {/* Battle Area */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4 p-4">
        {/* Player */}
        <div className="bg-gray-800/70 rounded-2xl p-5 w-full max-w-xs border border-blue-500/30">
          <div className="text-center mb-3">
            <span className="text-3xl">🧑</span>
            <h2 className="text-white font-bold text-lg">{player.name}</h2>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>❤️ HP</span>
                <span>{player.hp}/{player.maxHp}</span>
              </div>
              <HpBar current={player.hp} max={player.maxHp} color="bg-gradient-to-r from-red-600 to-red-400" />
            </div>
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>💨 气数</span>
                <span>{player.qi}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(player.qi, 10) }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
                {player.qi === 0 && <span className="text-gray-500 text-xs">无气</span>}
                {player.qi > 10 && <span className="text-cyan-400 text-xs">+{player.qi - 10}</span>}
              </div>
            </div>
            {player.shieldLevel > 0 && (
              <div className="text-blue-300 text-sm mt-2">
                🛡️ 防御等级: {player.shieldLevel}
              </div>
            )}
            {player.lastAction && (
              <div className="text-gray-400 text-xs mt-2">
                上回合: {player.lastAction.type === 'attack' ? '攻击' : player.lastAction.type === 'defend' ? '防御' : '吸气'}
                {player.lastAction.type !== 'inhale' ? ` Lv.${player.lastAction.level}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* VS */}
        <div className="text-4xl font-bold text-yellow-400 animate-pulse">VS</div>

        {/* Opponent */}
        <div className="bg-gray-800/70 rounded-2xl p-5 w-full max-w-xs border border-red-500/30">
          <div className="text-center mb-3">
            <span className="text-3xl">👹</span>
            <h2 className="text-white font-bold text-lg">{opponent.name}</h2>
          </div>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>❤️ HP</span>
                <span>{opponent.hp}/{opponent.maxHp}</span>
              </div>
              <HpBar current={opponent.hp} max={opponent.maxHp} color="bg-gradient-to-r from-red-600 to-red-400" />
            </div>
            <div>
              <div className="flex justify-between text-sm text-gray-300 mb-1">
                <span>💨 气数</span>
                <span>{opponent.qi}</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(opponent.qi, 10) }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-orange-400 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
                {opponent.qi === 0 && <span className="text-gray-500 text-xs">无气</span>}
                {opponent.qi > 10 && <span className="text-orange-400 text-xs">+{opponent.qi - 10}</span>}
              </div>
            </div>
            {opponent.shieldLevel > 0 && (
              <div className="text-blue-300 text-sm mt-2">
                🛡️ 防御等级: {opponent.shieldLevel}
              </div>
            )}
            {opponent.lastAction && (
              <div className="text-gray-400 text-xs mt-2">
                上回合: {opponent.lastAction.type === 'attack' ? '攻击' : opponent.lastAction.type === 'defend' ? '防御' : '吸气'}
                {opponent.lastAction.type !== 'inhale' ? ` Lv.${opponent.lastAction.level}` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold text-xl px-8 py-4 rounded-2xl shadow-2xl shadow-yellow-500/50">
            📢 已进入下一回合
          </div>
        </div>
      )}

      {/* Action Panel */}
      <div className="bg-black/50 border-t border-gray-700 p-4">
        {/* Action type selection */}
        <div className="flex justify-center gap-3 mb-3">
          <button
            onClick={() => { setSelectedAction('defend'); setSelectedLevel(1); }}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              selectedAction === 'defend'
                ? 'bg-blue-600 text-white scale-105'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            } disabled:opacity-50`}
          >
            🛡️ 防御
          </button>
          <button
            onClick={() => { setSelectedAction('attack'); setSelectedLevel(1); }}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-lg font-bold transition-all ${
              selectedAction === 'attack'
                ? 'bg-red-600 text-white scale-105'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
                🌬️ 吸气（气数+1）
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

        {isProcessing && (
          <div className="text-center text-yellow-400 animate-pulse">
            ⏳ 对手思考中...
          </div>
        )}
      </div>

      {/* Battle Log */}
      <div className="bg-black/60 border-t border-gray-700 p-3 max-h-40 overflow-y-auto" ref={logRef}>
        <div className="space-y-1">
          {logs.length === 0 && (
            <p className="text-gray-500 text-sm text-center">战斗日志将在此显示...</p>
          )}
          {logs.map((log, i) => (
            <p key={i} className={`text-sm ${
              log.type === 'attack' ? 'text-red-400' :
              log.type === 'defend' ? 'text-blue-400' :
              log.type === 'inhale' ? 'text-green-400' :
              log.type === 'damage' ? 'text-orange-400' :
              log.type === 'system' ? 'text-yellow-300 font-bold' :
              'text-gray-400'
            }`}>{log.text}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
