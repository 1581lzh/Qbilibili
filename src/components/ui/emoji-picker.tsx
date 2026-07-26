"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { DOUYIN_EMOJI_LIST } from "@/lib/douyin-emoji-data";

// 抖音表情作为第一个分类
const DOUYIN_CATEGORY = {
  name: "抖音",
  icon: "🤪",
  emojis: DOUYIN_EMOJI_LIST.map((e) => ({ emoji: e.code, label: e.name, url: e.url })),
  isDouyin: true as const,
};

// Unicode emoji 分类
const UNICODE_CATEGORIES = [
  {
    name: "表情",
    icon: "😀",
    emojis: [
      { emoji: "😀", label: "大笑" }, { emoji: "😃", label: "笑脸" },
      { emoji: "😄", label: "开心" }, { emoji: "😁", label: "嘿嘿" },
      { emoji: "😆", label: "咧嘴笑" }, { emoji: "😅", label: "汗笑" },
      { emoji: "🤣", label: "笑哭" }, { emoji: "😂", label: "喜极而泣" },
      { emoji: "🙂", label: "微笑" }, { emoji: "😊", label: "害羞" },
      { emoji: "🥰", label: "恋爱" }, { emoji: "😍", label: "花痴" },
      { emoji: "🤩", label: "星星眼" }, { emoji: "😘", label: "飞吻" },
      { emoji: "😋", label: "好吃" }, { emoji: "😛", label: "吐舌" },
      { emoji: "😜", label: "调皮" }, { emoji: "🤪", label: "疯狂" },
      { emoji: "🤔", label: "思考" }, { emoji: "😏", label: "得意" },
      { emoji: "😒", label: "白眼" }, { emoji: "🙄", label: "翻白眼" },
      { emoji: "😬", label: "龇牙" }, { emoji: "😌", label: "放松" },
      { emoji: "😔", label: "失望" }, { emoji: "😪", label: "困" },
      { emoji: "😴", label: "睡觉" }, { emoji: "😷", label: "口罩" },
      { emoji: "🤒", label: "发烧" }, { emoji: "🤕", label: "受伤" },
      { emoji: "🤢", label: "恶心" }, { emoji: "🤮", label: "呕吐" },
      { emoji: "🥵", label: "热" }, { emoji: "🥶", label: "冷" },
      { emoji: "🥴", label: "晕" }, { emoji: "😵", label: "头晕" },
      { emoji: "🤯", label: "爆炸头" }, { emoji: "🤠", label: "牛仔" },
      { emoji: "🥳", label: "派对" }, { emoji: "😎", label: "酷" },
      { emoji: "🤓", label: "书呆子" }, { emoji: "😕", label: "困惑" },
      { emoji: "😟", label: "担心" }, { emoji: "🙁", label: "微皱眉" },
      { emoji: "😮", label: "惊讶" }, { emoji: "😯", label: "震惊" },
      { emoji: "😲", label: "惊喜" }, { emoji: "😳", label: "脸红" },
      { emoji: "🥺", label: "恳求" }, { emoji: "😢", label: "流泪" },
      { emoji: "😭", label: "大哭" }, { emoji: "😱", label: "尖叫" },
      { emoji: "😖", label: "纠结" }, { emoji: "😣", label: "忍耐" },
      { emoji: "😞", label: "沮丧" }, { emoji: "😓", label: "汗" },
      { emoji: "😩", label: "累" }, { emoji: "😫", label: "疲惫" },
      { emoji: "😤", label: "生气" }, { emoji: "😡", label: "愤怒" },
      { emoji: "😠", label: "恼怒" }, { emoji: "🤬", label: "骂人" },
      { emoji: "😈", label: "恶魔笑" }, { emoji: "👿", label: "恶魔" },
      { emoji: "💀", label: "骷髅" }, { emoji: "💩", label: "便便" },
      { emoji: "🤡", label: "小丑" }, { emoji: "👻", label: "鬼" },
      { emoji: "👽", label: "外星人" }, { emoji: "🤖", label: "机器人" },
    ],
  },
  {
    name: "手势",
    icon: "👋",
    emojis: [
      { emoji: "👋", label: "挥手" }, { emoji: "🤚", label: "举手" },
      { emoji: "✋", label: "停" }, { emoji: "👌", label: "OK" },
      { emoji: "✌️", label: "胜利" }, { emoji: "🤞", label: "交叉手指" },
      { emoji: "🤟", label: "摇滚" }, { emoji: "🤘", label: " horns" },
      { emoji: "🤙", label: "打电话" }, { emoji: "👈", label: "向左指" },
      { emoji: "👉", label: "向右指" }, { emoji: "👆", label: "向上指" },
      { emoji: "👇", label: "向下指" }, { emoji: "👍", label: "赞" },
      { emoji: "👎", label: "踩" }, { emoji: "✊", label: "拳头" },
      { emoji: "👊", label: "打" }, { emoji: "🤛", label: "左拳" },
      { emoji: "🤜", label: "右拳" }, { emoji: "👏", label: "鼓掌" },
      { emoji: "🙌", label: "庆祝" }, { emoji: "👐", label: "张开手" },
      { emoji: "🤝", label: "握手" }, { emoji: "🙏", label: "祈祷" },
      { emoji: "💪", label: "肌肉" },
    ],
  },
  {
    name: "爱心",
    icon: "❤️",
    emojis: [
      { emoji: "❤️", label: "红心" }, { emoji: "🧡", label: "橙心" },
      { emoji: "💛", label: "黄心" }, { emoji: "💚", label: "绿心" },
      { emoji: "💙", label: "蓝心" }, { emoji: "💜", label: "紫心" },
      { emoji: "🖤", label: "黑心" }, { emoji: "🤍", label: "白心" },
      { emoji: "💔", label: "碎心" }, { emoji: "💕", label: "两颗心" },
      { emoji: "💞", label: "旋转心" }, { emoji: "💓", label: "跳动心" },
      { emoji: "💗", label: "增涨心" }, { emoji: "💖", label: "闪耀心" },
      { emoji: "💘", label: "丘比特" }, { emoji: "💝", label: "礼物心" },
      { emoji: "💟", label: "心形装饰" }, { emoji: "💋", label: "吻" },
      { emoji: "💯", label: "满分" }, { emoji: "✨", label: "闪耀" },
      { emoji: "🔥", label: "火焰" }, { emoji: "⭐", label: "星星" },
      { emoji: "🌟", label: "发光星" }, { emoji: "💫", label: "流星" },
    ],
  },
  {
    name: "动物",
    icon: "🐶",
    emojis: [
      { emoji: "🐶", label: "狗" }, { emoji: "🐱", label: "猫" },
      { emoji: "🐭", label: "老鼠" }, { emoji: "🐹", label: "仓鼠" },
      { emoji: "🐰", label: "兔子" }, { emoji: "🦊", label: "狐狸" },
      { emoji: "🐻", label: "熊" }, { emoji: "🐼", label: "熊猫" },
      { emoji: "🐨", label: "考拉" }, { emoji: "🐯", label: "老虎" },
      { emoji: "🦁", label: "狮子" }, { emoji: "🐮", label: "牛" },
      { emoji: "🐷", label: "猪" }, { emoji: "🐸", label: "青蛙" },
      { emoji: "🐵", label: "猴子" }, { emoji: "🐔", label: "鸡" },
      { emoji: "🐧", label: "企鹅" }, { emoji: "🐦", label: "鸟" },
      { emoji: "🦆", label: "鸭" }, { emoji: "🦅", label: "鹰" },
      { emoji: "🦉", label: "猫头鹰" }, { emoji: "🐺", label: "狼" },
      { emoji: "🐴", label: "马" }, { emoji: "🦄", label: "独角兽" },
      { emoji: "🐝", label: "蜜蜂" }, { emoji: "🐛", label: "毛毛虫" },
      { emoji: "🦋", label: "蝴蝶" }, { emoji: "🐌", label: "蜗牛" },
      { emoji: "🐢", label: "乌龟" }, { emoji: "🐍", label: "蛇" },
      { emoji: "🐙", label: "章鱼" }, { emoji: "🦑", label: "鱿鱼" },
      { emoji: "🦐", label: "虾" }, { emoji: "🦀", label: "螃蟹" },
      { emoji: "🐡", label: "河豚" }, { emoji: "🐠", label: "热带鱼" },
      { emoji: "🐟", label: "鱼" }, { emoji: "🐬", label: "海豚" },
      { emoji: "🐳", label: "鲸鱼" }, { emoji: "🦈", label: "鲨鱼" },
    ],
  },
  {
    name: "食物",
    icon: "🍔",
    emojis: [
      { emoji: "🍏", label: "青苹果" }, { emoji: "🍎", label: "苹果" },
      { emoji: "🍊", label: "橘子" }, { emoji: "🍋", label: "柠檬" },
      { emoji: "🍌", label: "香蕉" }, { emoji: "🍉", label: "西瓜" },
      { emoji: "🍇", label: "葡萄" }, { emoji: "🍓", label: "草莓" },
      { emoji: "🍒", label: "樱桃" }, { emoji: "🍑", label: "桃子" },
      { emoji: "🥭", label: "芒果" }, { emoji: "🍍", label: "菠萝" },
      { emoji: "🥥", label: "椰子" }, { emoji: "🥝", label: "猕猴桃" },
      { emoji: "🍅", label: "番茄" }, { emoji: "🍆", label: "茄子" },
      { emoji: "🥑", label: "牛油果" }, { emoji: "🥦", label: "西兰花" },
      { emoji: "🌽", label: "玉米" }, { emoji: "🥕", label: "胡萝卜" },
      { emoji: "🍞", label: "面包" }, { emoji: "🥐", label: "牛角包" },
      { emoji: "🧀", label: "奶酪" }, { emoji: "🥚", label: "鸡蛋" },
      { emoji: "🍳", label: "煎蛋" }, { emoji: "🥞", label: "松饼" },
      { emoji: "🥓", label: "培根" }, { emoji: "🥩", label: "肉" },
      { emoji: "🍗", label: "鸡腿" }, { emoji: "🍖", label: "排骨" },
      { emoji: "🌭", label: "热狗" }, { emoji: "🍔", label: "汉堡" },
      { emoji: "🍟", label: "薯条" }, { emoji: "🍕", label: "披萨" },
      { emoji: "🥪", label: "三明治" }, { emoji: "🌮", label: "墨西哥卷" },
      { emoji: "🍜", label: "面条" }, { emoji: "🍝", label: "意面" },
      { emoji: "🍛", label: "咖喱" }, { emoji: "🍣", label: "寿司" },
      { emoji: "🍱", label: "便当" }, { emoji: "🥟", label: "饺子" },
      { emoji: "🍙", label: "饭团" }, { emoji: "🍚", label: "米饭" },
      { emoji: "🍡", label: "团子" }, { emoji: "🍧", label: "刨冰" },
      { emoji: "🍨", label: "冰淇淋" }, { emoji: "🍦", label: "甜筒" },
      { emoji: "🧁", label: "杯子蛋糕" }, { emoji: "🍰", label: "蛋糕" },
      { emoji: "🎂", label: "生日蛋糕" }, { emoji: "🍮", label: "布丁" },
      { emoji: "🍭", label: "棒棒糖" }, { emoji: "🍬", label: "糖果" },
      { emoji: "🍫", label: "巧克力" }, { emoji: "🍿", label: "爆米花" },
      { emoji: "🍩", label: "甜甜圈" }, { emoji: "🍪", label: "饼干" },
      { emoji: "🌰", label: "栗子" }, { emoji: "🥜", label: "花生" },
      { emoji: "🍯", label: "蜂蜜" }, { emoji: "🥛", label: "牛奶" },
      { emoji: "☕", label: "咖啡" }, { emoji: "🍵", label: "茶" },
      { emoji: "🍶", label: "清酒" }, { emoji: "🍾", label: "香槟" },
      { emoji: "🍷", label: "红酒" }, { emoji: "🍸", label: "鸡尾酒" },
      { emoji: "🍹", label: "热带饮品" }, { emoji: "🍺", label: "啤酒" },
      { emoji: "🍻", label: "干杯" }, { emoji: "🥂", label: "碰杯" },
    ],
  },
  {
    name: "物品",
    icon: "💡",
    emojis: [
      { emoji: "⌚", label: "手表" }, { emoji: "📱", label: "手机" },
      { emoji: "💻", label: "电脑" }, { emoji: "⌨️", label: "键盘" },
      { emoji: "🖥️", label: "显示器" }, { emoji: "🖨️", label: "打印机" },
      { emoji: "🖱️", label: "鼠标" }, { emoji: "📷", label: "相机" },
      { emoji: "📸", label: "拍照" }, { emoji: "📹", label: "摄像机" },
      { emoji: "🎥", label: "电影" }, { emoji: "📺", label: "电视" },
      { emoji: "📻", label: "收音机" }, { emoji: "🎙️", label: "麦克风" },
      { emoji: "🧭", label: "指南针" }, { emoji: "⏰", label: "闹钟" },
      { emoji: "🔋", label: "电池" }, { emoji: "💡", label: "灯泡" },
      { emoji: "🔦", label: "手电筒" }, { emoji: "🕯️", label: "蜡烛" },
      { emoji: "💰", label: "钱袋" }, { emoji: "💵", label: "美元" },
      { emoji: "💳", label: "信用卡" }, { emoji: "✉️", label: "信封" },
      { emoji: "📦", label: "包裹" }, { emoji: "📌", label: "图钉" },
      { emoji: "📎", label: "回形针" }, { emoji: "✂️", label: "剪刀" },
      { emoji: "🖊️", label: "钢笔" }, { emoji: "✏️", label: "铅笔" },
      { emoji: "📝", label: "备忘录" }, { emoji: "📁", label: "文件夹" },
      { emoji: "📅", label: "日历" }, { emoji: "📊", label: "柱状图" },
      { emoji: "📋", label: "剪贴板" }, { emoji: "🔒", label: "锁" },
      { emoji: "🔓", label: "开锁" }, { emoji: "🔑", label: "钥匙" },
    ],
  },
  {
    name: "符号",
    icon: "💯",
    emojis: [
      { emoji: "💯", label: "满分" }, { emoji: "✅", label: "对号" },
      { emoji: "❌", label: "叉号" }, { emoji: "❗", label: "感叹号" },
      { emoji: "❓", label: "问号" }, { emoji: "⚠️", label: "警告" },
      { emoji: "🚫", label: "禁止" }, { emoji: "🔴", label: "红圆" },
      { emoji: "🟠", label: "橙圆" }, { emoji: "🟡", label: "黄圆" },
      { emoji: "🟢", label: "绿圆" }, { emoji: "🔵", label: "蓝圆" },
      { emoji: "🟣", label: "紫圆" }, { emoji: "⚫", label: "黑圆" },
      { emoji: "⚪", label: "白圆" }, { emoji: "🟤", label: "棕圆" },
      { emoji: "🔸", label: "小橙菱" }, { emoji: "🔹", label: "小蓝菱" },
      { emoji: "🔶", label: "大橙菱" }, { emoji: "🔷", label: "大蓝菱" },
      { emoji: "🔺", label: "红三角" }, { emoji: "🔻", label: "倒红三角" },
      { emoji: "💠", label: "钻石" }, { emoji: "🔘", label: "按钮" },
    ],
  },
];

const ALL_CATEGORIES = [DOUYIN_CATEGORY, ...UNICODE_CATEGORIES];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return ALL_CATEGORIES;
    const q = search.toLowerCase();
    return ALL_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter(
        (e) => e.label.toLowerCase().includes(q) || e.emoji.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    setIsOpen(false);
    setSearch("");
  }, [onSelect]);

  const currentEmojis = useMemo(() => {
    if (search.trim()) {
      return filteredCategories.flatMap((cat) => cat.emojis);
    }
    return ALL_CATEGORIES[activeCategory]?.emojis || [];
  }, [search, activeCategory, filteredCategories]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-7 w-7 items-center justify-center rounded text-base text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        title="插入 emoji"
      >
        😊
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          className="absolute bottom-full left-0 z-50 mb-2 w-[320px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
        >
          {/* 搜索栏 */}
          <div className="border-b border-zinc-100 p-2 dark:border-zinc-700">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索..."
              className="w-full rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-900 placeholder-zinc-400 focus:border-[#FB7299] focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
          </div>

          {/* 分类标签 */}
          {!search && (
            <div className="flex border-b border-zinc-100 dark:border-zinc-700">
              {ALL_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setActiveCategory(i)}
                  className={`flex-1 py-1.5 text-center text-sm transition-colors ${
                    activeCategory === i
                      ? "border-b-2 border-[#FB7299] text-[#FB7299]"
                      : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  }`}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}

          {/* Emoji 网格 */}
          <div className="h-[240px] overflow-y-auto p-1.5 [scrollbar-width:thin] [scrollbar-color:rgb(161_161_170)_transparent] dark:[scrollbar-color:rgb(82_82_91)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
            <div className="grid grid-cols-8 gap-0.5">
              {currentEmojis.map((e, i) => (
                <button
                  key={`${activeCategory}-${i}`}
                  type="button"
                  onClick={() => handleSelect(e.emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  title={e.label}
                >
                  {"url" in e && (e as any).url ? (
                    <img
                      src={(e as any).url}
                      alt={e.label}
                      className="h-6 w-6"
                      draggable={false}
                      loading={i < 24 ? "eager" : "lazy"}
                      decoding="async"
                    />
                  ) : (
                    <span className="text-lg">{e.emoji}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
