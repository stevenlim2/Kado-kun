/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import * as htmlToImage from 'html-to-image';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  ArrowLeft, ArrowUp, ArrowDown, ArrowRight, Trash2, Copy, Plus, GripVertical, RefreshCw, 
  ChevronRight, ChevronLeft, Download, Image as ImageIcon, 
  Type as TypeIcon, Check, Maximize2, Minimize2, Palette, 
  Layout, Share2, FileText, Search, Sparkles, Zap, Clock, ExternalLink, Link,
  AlertCircle, Info, Loader2, Wand2
} from "lucide-react";
import { motion, Reorder } from "motion/react";
import { COPY_PLAYBOOK } from "./copyPlaybook";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

// Initialize Gemini AI
let genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isKeyChecking, setIsKeyChecking] = useState(true);
  const [skipKeySelection, setSkipKeySelection] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  
  useEffect(() => {
    // Load saved API key from localStorage
    const savedKey = localStorage.getItem("user_gemini_api_key");
    if (savedKey) {
      setUserApiKey(savedKey);
    }

    const checkKey = async () => {
      // 1. Secrets에 키가 등록되어 있는지 먼저 확인
      const envKey = process.env.GEMINI_API_KEY;
      const isEnvKeySet = envKey && envKey !== "" && envKey !== "MY_GEMINI_API_KEY";
      
      if (isEnvKeySet || savedKey) {
        setHasApiKey(true);
        setSkipKeySelection(true);
      } else if ((window as any).aistudio) {
        // 2. Secrets에 없으면 플랫폼 키 선택기 확인
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
      setIsKeyChecking(false);
    };
    checkKey();
  }, []);

  // Update genAI whenever userApiKey or env key changes
  useEffect(() => {
    const activeKey = userApiKey || process.env.GEMINI_API_KEY || "";
    if (activeKey && activeKey !== "MY_GEMINI_API_KEY") {
      console.log("Initializing Gemini AI with key:", activeKey.substring(0, 5) + "...");
      genAI = new GoogleGenAI({ apiKey: activeKey });
    }
  }, [userApiKey]);

  const handleSaveUserKey = (key: string) => {
    const trimmedKey = key.trim();
    setUserApiKey(trimmedKey);
    localStorage.setItem("user_gemini_api_key", trimmedKey);
    if (trimmedKey) {
      setHasApiKey(true);
      setSkipKeySelection(true);
    }
  };

  const handleOpenKeySelector = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
      setSkipKeySelection(false);
      // Re-initialize genAI with the new key
      genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    }
  };

  const handleSkipKey = () => {
    setSkipKeySelection(true);
  };
  // 1. 카드 데이터 상태
  const [view, setView] = useState<"intro" | "editor">("intro");
  const [cardCount, setCardCount] = useState(6);
  const [generatedCards, setGeneratedCards] = useState<Array<{
    title: string, 
    content: string, 
    iconKeyword: string,
    aiGeneratedImg?: string | null,
    uploadedImg?: string | null,
    imgScale?: number,
    imgOffsetX?: number,
    imgOffsetY?: number,
    chartScale?: number,
    visualType?: 'icon' | 'chart' | 'diagram' | 'photo',
    visualData?: any
  }>>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);

  // 현재 활성화된 카드 데이터 (편의용)
  const currentCard = generatedCards[currentCardIdx] || { title: "", content: "", iconKeyword: "" };
  
  // 2. 이미지 및 크기 조절 상태 (이것들은 에디터 UI 반응성을 위해 유지하되 동기화 강화)
  const [imageKeyword, setImageKeyword] = useState(""); 
  const [isImgLoading, setIsImgLoading] = useState(false);
  const [isProMode, setIsProMode] = useState(false);
  const [selectedImageStyle, setSelectedImageStyle] = useState("글래스모피즘");
  
  // 3. AI 요약 팝업 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [summaryMode, setSummaryMode] = useState<"text" | "url">("url");
  const [configMode, setConfigMode] = useState<"auto" | "manual">("auto");
  const [articleText, setArticleText] = useState(""); 
  const [articleUrl, setArticleUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [imageTab, setImageTab] = useState<'ai' | 'upload'>('ai');
  const [showHighlightGuideTitle, setShowHighlightGuideTitle] = useState(false);
  const [showHighlightGuideContent, setShowHighlightGuideContent] = useState(false);
  const [floatingMenu, setFloatingMenu] = useState<{ visible: boolean, x: number, y: number, field: 'title' | 'content' | null }>({
    visible: false,
    x: 0,
    y: 0,
    field: null
  });
  const [theme, setTheme] = useState<"light" | "dark" | "blue">("light");
  const [selectedTone, setSelectedTone] = useState("자동 분석 (기사 맞춤형)");
  const [hashtags, setHashtags] = useState("");
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [downloadScale, setDownloadScale] = useState(1);
  const [statusMessage, setStatusMessage] = useState<{type: 'error' | 'info', text: string} | null>(null);
  const [editingChartItem, setEditingChartItem] = useState<{idx: number, type: 'label' | 'value'} | null>(null);
  
  const cardRef = useRef<HTMLDivElement>(null);
  const allCardsRef = useRef<HTMLDivElement>(null);

  // --- 🔄 [유틸] 현재 카드 데이터 업데이트 ---
  const updateCurrentCard = (updates: Partial<typeof currentCard>) => {
    setGeneratedCards(prev => {
      const next = [...prev];
      if (next[currentCardIdx]) {
        next[currentCardIdx] = { ...next[currentCardIdx], ...updates };
      }
      return next;
    });
  };

  // 로고 이미지 (제공해주신 공식 SVG 데이터로 영구 고정)
  const NHNCloudLogo = ({ color = "#191919", scale = 1.0 }: { color?: string, scale?: number }) => (
    <div style={{ userSelect: 'none', transform: `scale(${scale})`, transformOrigin: 'center' }}>
      <svg width="280" height="40" viewBox="0 0 140 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M55.8984 15.9702C54.5451 14.4035 53.7598 12.3334 53.7598 10.0055C53.7598 7.22652 54.8512 4.85029 56.7079 3.2111C58.3229 1.80953 60.4857 1 62.9344 1C64.5253 1 65.9269 1.28595 67.0707 1.80953C68.0453 2.26061 69.0925 3.04597 69.9705 4.13742L67.0223 6.61031C66.4061 5.9941 65.7859 5.539 65.0489 5.25707C64.4326 5.01945 63.7439 4.87848 63.0271 4.87848C61.5288 4.87848 60.4857 5.3054 59.5795 6.04243C58.4639 6.96876 57.7993 8.34616 57.7993 10.0095C57.7993 11.4353 58.2746 12.72 59.1284 13.6222C60.0548 14.621 61.4563 15.1446 63.0271 15.1446C63.8366 15.1446 64.5937 14.9795 65.214 14.6935C65.9993 14.3592 66.6639 13.8397 67.2559 13.1026L70.2282 15.3379C69.4429 16.4777 68.5649 17.3597 67.4734 17.9759C66.2611 18.6646 64.7871 19.0231 62.9344 19.0231C60.0346 19.0231 57.5658 17.8591 55.9024 15.9823L55.8984 15.9702Z" fill={color}/>
        <path d="M76.4219 1.45117V14.6412H84.7629V18.564H72.334V1.45117H76.4219Z" fill={color}/>
        <path d="M88.2513 16.518C86.5638 14.9029 85.6133 12.5952 85.6133 10.0055C85.6133 7.41581 86.5638 5.11208 88.2513 3.49302C89.8905 1.92633 92.1258 1 94.6429 1C97.1601 1 99.3954 1.92633 101.035 3.49705C102.722 5.11208 103.673 7.41581 103.673 10.0095C103.673 12.6032 102.722 14.9029 101.035 16.522C99.3954 18.0887 97.1601 19.019 94.6429 19.019C92.1258 19.019 89.8905 18.0927 88.2513 16.522V16.518ZM98.3281 13.5698C99.1578 12.6435 99.637 11.4554 99.637 10.0055C99.637 8.55559 99.1618 7.36748 98.3281 6.44116C97.4259 5.4665 96.1895 4.89459 94.6429 4.89459C93.0964 4.89459 91.8398 5.4665 90.9376 6.44116C90.108 7.36748 89.6529 8.55559 89.6529 10.0055C89.6529 11.4554 90.1281 12.6435 90.9618 13.5698C91.864 14.5445 93.1004 15.1124 94.6429 15.1124C96.1855 15.1124 97.4219 14.5405 98.3281 13.5698Z" fill={color}/>
        <path d="M109.448 18.1573C107.95 17.3719 106.931 16.2079 106.335 14.6654C106.049 13.88 105.908 12.8611 105.908 11.9106V1.45117H109.948V11.383C109.948 11.8341 110.065 12.6919 110.185 13.0222C110.471 13.8519 110.922 14.3996 111.563 14.7097C112.372 15.0883 113.037 15.1125 113.391 15.1125C113.746 15.1125 114.414 15.0883 115.22 14.7097C115.86 14.3996 116.311 13.8559 116.597 13.0222C116.718 12.6879 116.835 11.8341 116.835 11.383V1.45117H120.874V11.9066C120.874 12.8571 120.733 13.88 120.447 14.6614C119.851 16.2079 118.832 17.3719 117.334 18.1532C116.243 18.7251 114.861 19.0312 113.391 19.0312C111.921 19.0312 110.54 18.7211 109.448 18.1532V18.1573Z" fill={color}/>
        <path d="M130.622 18.5602H124.024L124 1.4502H131.334C132.07 1.4502 133.495 1.57103 134.183 1.73617C136.391 2.28395 137.695 3.39964 138.717 5.03895C139.594 6.41645 140 8.12825 140 10.0052C140 11.572 139.69 12.9777 139.147 14.186C138.246 16.1355 136.963 17.3478 134.71 18.0366C133.547 18.391 132.026 18.5602 130.626 18.5602H130.622ZM130.719 5.32492H127.967V14.7137H131.149C131.934 14.7137 132.907 14.5485 133.261 14.4277C134.259 14.1176 134.826 13.6181 135.233 12.8609C135.707 12.0271 135.848 11.0323 135.848 10.0092C135.848 9.19964 135.752 8.44242 135.494 7.79797C135.068 6.75075 134.617 6.11033 133.334 5.61089C132.883 5.44575 131.934 5.32492 130.723 5.32492H130.719Z" fill={color}/>
        <path d="M25.0232 15.024H27.4195V4.95117H25.0232V8.83368H20.6855V4.95117H18.2852V15.024H20.6855V11.3267V11.1334L25.0232 11.1455V11.3267V15.024Z" fill={color}/>
        <path d="M6.68968 10.9925L2.15874 4.68945L0 5.80104V15.024H2.34401V8.95055L7.09646 15.3543H7.10451L9.06188 14.3353V4.95124H6.68968V10.9925Z" fill={color}/>
        <path d="M38.9905 8.95055L43.7429 15.3543H43.751L45.7084 14.3313V4.95124H43.3362V10.9925L38.8012 4.68945L36.6465 5.80104V15.024H38.9905V8.95055Z" fill={color}/>
      </svg>
    </div>
  );

  // 이미지 파일 업로드
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateCurrentCard({
          uploadedImg: reader.result as string,
          imgScale: 1.0
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 🎨 [기능] 텍스트 강조 렌더링 ---
  const renderEmphasizedText = (text: string, type: 'title' | 'content') => {
    if (!text) return null;
    
    // **강조** 패턴 찾기
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const innerText = part.slice(2, -2);
        if (type === 'title') {
          return (
            <span key={i} style={{ 
              display: 'inline-block',
              fontWeight: '700',
              background: "linear-gradient(to bottom, #06BFF7 0%, #001AFF 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              padding: '0 2px',
              verticalAlign: 'top'
            }}>
              {innerText}
            </span>
          );
        } else {
          return (
            <span key={i} style={{ 
              color: '#005EFF', 
              fontWeight: '700' 
            }}>
              {innerText}
            </span>
          );
        }
      }
      return part;
    });
  };

  // --- 🎨 [기능] 선택 텍스트 강조 처리 (토글 기능 추가) ---
  const handleHighlightSelection = (field: 'title' | 'content') => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const selectedText = selection.toString();
    if (!selectedText) return;

    // 1. 미리보기 요소 내부인지 확인 및 오프셋 계산
    let parent = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
    let isPreview = false;
    let previewElement = null;
    
    while (parent && parent instanceof HTMLElement) {
      if (parent.getAttribute('data-editable-field') === field) {
        isPreview = true;
        previewElement = parent;
        break;
      }
      parent = parent.parentElement;
    }

    let start = 0;
    let end = 0;
    let rawText = currentCard[field];

    if (isPreview && previewElement) {
      // 미리보기(contentEditable)에서의 선택 오프셋 (innerText 기준)
      const preRange = range.cloneRange();
      preRange.selectNodeContents(previewElement);
      preRange.setEnd(range.startContainer, range.startOffset);
      const plainStart = preRange.toString().length;
      const plainEnd = plainStart + selectedText.length;

      // plain 오프셋을 raw 오프셋(** 포함)으로 매핑
      let currentPlainIdx = 0;
      let rawStart = -1;
      let rawEnd = -1;
      for (let i = 0; i < rawText.length; i++) {
        if (currentPlainIdx === plainStart && rawStart === -1) rawStart = i;
        if (currentPlainIdx === plainEnd && rawEnd === -1) rawEnd = i;
        if (rawText.substring(i, i + 2) === "**") {
          i++; continue;
        }
        currentPlainIdx++;
      }
      if (rawEnd === -1) rawEnd = rawText.length;
      start = rawStart;
      end = rawEnd;
    } else {
      // 에디터 textarea에서의 선택 (기존 방식)
      const textarea = document.querySelector(`textarea[data-field="${field}"]`) as HTMLTextAreaElement;
      if (textarea) {
        start = textarea.selectionStart;
        end = textarea.selectionEnd;
      }
    }

    if (start === end) return;

    const rawSelected = rawText.substring(start, end);
    let newText = "";

    // 이미 강조된 경우 강조 제거, 아니면 추가
    if (rawSelected.startsWith("**") && rawSelected.endsWith("**")) {
      newText = rawText.substring(0, start) + rawSelected.slice(2, -2) + rawText.substring(end);
    } else {
      newText = rawText.substring(0, start) + `**${rawSelected}**` + rawText.substring(end);
    }
    
    updateCurrentCard({ [field]: newText });
    setFloatingMenu({ ...floatingMenu, visible: false });
    if (selection) selection.removeAllRanges();
  };

  // --- 🎨 [기능] 강조 해제 처리 (현재 페이지 전체 초기화) ---
  const handleClearHighlight = () => {
    updateCurrentCard({ 
      title: currentCard.title.replace(/\*\*/g, ''),
      content: currentCard.content.replace(/\*\*/g, '')
    });
    setFloatingMenu({ ...floatingMenu, visible: false });
  };

  // --- 🎨 [기능] 텍스트 선택 감지 및 플로팅 메뉴 표시 ---
  const handleTextMouseUp = (e: React.MouseEvent<HTMLElement>, field: 'title' | 'content') => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      // 선택된 텍스트가 있을 때만 메뉴 표시
      setFloatingMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY - 40, // 마우스 위치보다 약간 위
        field
      });
    } else {
      setFloatingMenu({ ...floatingMenu, visible: false });
    }
  };

  // --- 🤖 [기능] Real Gemini AI 기사 요약 ---
  const handleAnalyzeArticle = async (overrideTone?: string | React.MouseEvent) => {
    console.log("handleAnalyzeArticle START", { overrideTone, summaryMode, articleUrl, articleText });
    const isUrlMode = summaryMode === "url";
    
    // overrideTone이 MouseEvent인 경우(직접 onClick에 연결된 경우) 무시
    const actualTone = typeof overrideTone === 'string' ? overrideTone : undefined;

    if (isUrlMode) {
      if (!articleUrl.trim()) {
        setStatusMessage({ type: 'error', text: "분석할 기사 URL을 입력해주세요." });
        return;
      }
      if (!articleUrl.startsWith("http")) {
        setStatusMessage({ type: 'error', text: "올바른 URL 형식이 아닙니다. 'https://'를 포함한 전체 주소를 입력해 주세요." });
        return;
      }
    } else {
      if (articleText.trim().length < 10) {
        setStatusMessage({ type: 'error', text: "분석할 기사 내용을 최소 10자 이상 입력해주세요." });
        return;
      }
    }

    setIsAnalyzing(true);
    setStatusMessage({ type: 'info', text: "기사 내용을 분석하고 있습니다..." });
    try {
      const finalCount = cardCount; // 직접 설정한 장수 반영
      let extractedContent = articleText;

      const activeTone = actualTone || selectedTone;
      let toneInstruction = "";
      
      const toneMap: Record<string, string> = {
        "자동 분석 (기사 맞춤형)": "기사 본문의 성격(정보 전달, 홍보, 비판, 감성 등)을 AI가 스스로 분석하여 가장 적합한 어조와 제목 스타일을 결정하십시오.",
        "기술 인사이트": "어조: 해설형, 중립적 | 제목 스타일: 개념/현상 명사형 | CTA: 공유 유도",
        "프로모션 안내": "어조: 명확하고 간결 | 제목 스타일: 혜택·기간 포함 | CTA: 클릭·신청 유도",
        "보도자료 요약": "어조: 공식적, 사실 중심 | 제목 스타일: 사실 명사형 | CTA: 전문 링크 연결",
        "교육센터 홍보": "어조: 친근, 동기 부여형 | 제목 스타일: 역량 향상 강조 | CTA: 신청 유도"
      };
      
      if (actualTone || configMode === "manual" || selectedTone === "자동 분석 (기사 맞춤형)") {
        toneInstruction = `\n\n[톤앤매너 지침]\n선택된 모드: ${activeTone}\n적용 지침: ${toneMap[activeTone] || activeTone}\n위 지침에 따라 기사 내용에 가장 잘 어울리는 어조와 스타일로 작성하십시오.`;
      }

      if (isUrlMode) {
        try {
          const extractRes = await fetch("/api/extract-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: articleUrl.trim() })
          });
          const extractData = await extractRes.json();
          if (extractData.error || !extractData.content) {
            throw new Error(extractData.error || "본문을 추출하지 못했습니다.");
          }
          extractedContent = extractData.content;
          setStatusMessage({ type: 'info', text: "본문 추출 완료! AI 분석을 시작합니다..." });
        } catch (err: any) {
          setStatusMessage({ type: 'error', text: `URL 본문 추출 실패: ${err.message}\n본문을 직접 복사해서 넣어주세요.` });
          setIsAnalyzing(false);
          return;
        }
      }

      const prompt = `다음 기사 내용을 바탕으로 카드뉴스를 작성하십시오.
        
        기사 내용: ${extractedContent}
        
        [카피 제작 가이드라인: NHN 카드뉴스 플레이북]
        ${COPY_PLAYBOOK}
        
        [핵심 규칙: 반드시 준수할 것]
        1. **콘텐츠 주제**: 제공된 텍스트 내용만 100% 반영하십시오. 
        2. **환각 방지**: 텍스트와 상관없는 '클라우드', 'NHN', 'IT 기술', '데이터 센터' 등의 단어를 절대 지어내지 마십시오. **오직 제공된 텍스트 정보만** 요약해야 합니다.
        3. **시각적 스타일**: 'NHN Cloud 스타일'은 오직 '깔끔하고 전문적인 비즈니스 디자인'을 의미합니다. 주제를 클라우드로 바꾸라는 뜻이 아닙니다.
        4. **카피 스타일**: 위 'NHN 카드뉴스 플레이북'의 프레임워크(AIDA, PAS 등)와 후킹 패턴을 활용하여 독자의 관심을 끌 수 있는 매력적인 카피를 작성하십시오. 특히 B2B 테크 독자에게 신뢰를 줄 수 있는 구체적인 수치와 명확한 문제 지목을 활용하십시오.
        
        [미션]
        1. 먼저 기사 내용을 바탕으로 구조화된 요약(summary)을 작성하십시오.
        2. 그 다음, 요약된 내용을 바탕으로 총 ${finalCount}장의 카드뉴스를 작성하십시오.${toneInstruction}
        
        [제약 사항]
        1. 첫 번째 카드(표지): 제목은 반드시 '정확히 3줄' (줄바꿈 \\n 사용). 각 줄은 15자 이내. 본문도 3줄 요약. 플레이북의 '후킹 패턴'을 적극 활용하십시오.
        2. 중간장 카드: 제목 반드시 2줄, 본문 반드시 4줄. 플레이북의 'PAS' 또는 'FAB' 프레임워크를 적용하십시오.
        3. 마지막 카드(CTA): 제목은 반드시 2줄로 작성하십시오. 첫 번째 줄은 핵심 강조 문구(예: **함께 성장해요**), 두 번째 줄은 부연 설명으로 구성하십시오. 본문은 반드시 '( 🔗 포스팅 본문 링크 참조 )'로 고정하십시오.
        4. 모든 줄바꿈은 \\n 문자를 사용. HTML 태그(<br> 등) 절대 사용 금지.
        5. visualType: 'icon', 'photo' 중 선택. (도표/다이어그램 절대 사용 금지)
        6. iconKeyword: 영문 명사 1단어. 기사 주제를 관통하는 핵심 단어.
        7. 금지: 컬러 코드, 이모지 사용 금지.
        8. 결과는 반드시 JSON 객체 형태여야 함.`;

      const modelName = isProMode ? "gemini-3.1-pro-preview" : "gemini-flash-latest";
      
      const response = await genAI.models.generateContent({
        model: modelName, 
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: { type: Type.BOOLEAN },
              errorMessage: { type: Type.STRING },
              summary: { type: Type.STRING },
              cards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    content: { type: Type.STRING },
                    iconKeyword: { type: Type.STRING },
                    visualType: { type: Type.STRING, enum: ['icon', 'photo'] },
                    visualData: { type: Type.ARRAY, items: { type: Type.STRING } }
                  },
                  required: ["title", "content", "iconKeyword", "visualType"]
                }
              }
            },
            required: ["success", "summary", "cards"]
          }
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      
      if (parsed.success === false) {
        setStatusMessage({ type: 'error', text: parsed.errorMessage || "기사 내용을 가져오지 못했습니다. 본문을 복사해서 넣어주세요!" });
        setIsAnalyzing(false);
        return;
      }

      const results = parsed.cards || [];
      
      if (results.length > 0) {
        // 초기 데이터 가공 (이미지 필드 등 포함)
        const initializedCards = results.map((c: any, idx: number) => {
          const isIntro = idx === 0;
          const isOutro = idx === results.length - 1;
          
          // 줄바꿈 정제 및 HTML 태그(<br>) 제거, 리터럴 \n 문자 처리
          const cleanText = (text: string) => text.replace(/<br\s*\/?>/gi, '').replace(/\\n/g, '\n').trim();
          
          const titleLines = cleanText(c.title).split("\n").map((s: string) => s.trim()).filter((s: string) => s);
          const contentLines = cleanText(c.content).split("\n").map((s: string) => s.trim()).filter((s: string) => s);

          return {
            ...c,
            title: isIntro 
              ? titleLines.slice(0, 3).join("\n") 
              : titleLines.slice(0, 2).join("\n"),
            content: isIntro 
              ? contentLines.slice(0, 3).join("\n") 
              : contentLines.slice(0, 4).join("\n"),
            aiGeneratedImg: null,
            uploadedImg: null,
            imgScale: 1.0,
            imgOffsetX: 0,
            imgOffsetY: 0,
            chartScale: 1.0
          };
        });

        setGeneratedCards(initializedCards);
        setCurrentCardIdx(0);
        setImageKeyword(initializedCards[0].iconKeyword);
        
        // [수정] 초기 생성 시 이미지를 자동으로 생성하지 않음
        setView("editor");
        setIsModalOpen(false);
        setStatusMessage(null);
      } else {
        setStatusMessage({ type: 'error', text: "기사 내용을 추출하거나 분석하는 데 실패했습니다. URL이 올바른지 확인해 주세요." });
      }
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      const errMsg = error.message || String(error);
      if (errMsg.includes("429") || errMsg.includes("quota")) {
        const isUsingPersonalKey = !!userApiKey;
        setStatusMessage({ 
          type: 'error', 
          text: isUsingPersonalKey 
            ? "입력하신 개인 API 키도 현재 사용량이 초과되었습니다. 잠시 후 다시 시도하거나, 유료 결제가 연동된 키인지 확인해 주세요."
            : "현재 AI 사용량이 많아 잠시 제한되었습니다. 개인 API 키를 입력하거나 잠시 후 다시 시도해 주세요." 
        });
      } else if (errMsg.includes("API_KEY_INVALID") || errMsg.includes("invalid") || errMsg.includes("401")) {
        setStatusMessage({ type: 'error', text: "입력하신 API 키가 유효하지 않습니다. 키를 다시 확인해 주세요." });
      } else if (errMsg.includes("URL")) {
        setStatusMessage({ type: 'error', text: "기사 URL을 읽어오는 데 실패했습니다. URL이 올바른지 확인해 주세요." });
      } else {
        setStatusMessage({ type: 'error', text: `AI 분석 중 오류가 발생했습니다: ${errMsg}` });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 카드 전환 로직
  const handleSwitchCard = (idx: number) => {
    if (!generatedCards[idx]) return;
    const card = generatedCards[idx];
    setCurrentCardIdx(idx);
    setImageKeyword(card.iconKeyword || "");
  };

  // 차트 데이터 재생성 로직
  const handleRegenerateChart = async (idx: number) => {
    const card = generatedCards[idx];
    if (!card) return;
    
    setIsChartLoading(true);
    try {
      const prompt = `다음 텍스트 내용을 바탕으로 카드뉴스에 들어갈 ${card.visualType === 'chart' ? '차트 데이터(항목명과 수치)' : '다이어그램 단계'}를 다시 추출해줘.
      텍스트: ${card.title} ${card.content}
      
      [제약 사항]
      1. ${card.visualType === 'chart' ? '차트인 경우: ["항목1:60", "항목2:85", ...] 형태의 문자열 배열 (최대 4개)' : '다이어그램인 경우: ["단계1", "단계2", "단계3", "단계4"] 형태의 문자열 배열 (최대 4개)'}
      2. 반드시 JSON 배열 형태로만 응답해줘.
      3. 기사 내용의 핵심 수치나 흐름을 반영해야 함.`;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const newData = JSON.parse(response.text || "[]");
      if (newData.length > 0) {
        setGeneratedCards(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], visualData: newData };
          return next;
        });
      }
    } catch (error) {
      console.error("Chart Regeneration Error:", error);
    } finally {
      setIsChartLoading(false);
    }
  };

  // 아이콘 생성 공통 로직
  const generateIcon = async (keyword: string, targetIdx: number, overrideStyle?: string) => {
    setIsImgLoading(true);
    try {
      // Re-initialize genAI right before use to ensure latest key
      genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      let stylePrompt = "";
      const currentStyle = overrideStyle || selectedImageStyle;
      
      switch (currentStyle) {
        case "글래스모피즘":
          stylePrompt = "A premium 3D voluminous, plump glass icon, featuring a soft gradient from clear sky blue to a very subtle cyan/teal tint. High-gloss finish with internal reflections, soft highlights, and a translucent iridescent glass texture. Bubble-like volume with smooth rounded edges.";
          break;
        case "심플아이콘":
          stylePrompt = "Official NHN Cloud subpage asset style: a clean, minimalist 2D flat vector icon. Uses a professional palette of NHN Cloud Blue (#005EFF), slate gray, and light gray. Simple geometric shapes, solid fills, no outlines, professional IT and cloud infrastructure aesthetic. High precision, minimalist vector art.";
          break;
        case "일러스트레이션":
          stylePrompt = "Official NHN Cloud technical illustration style: a clean, modern flat vector composition. Uses a professional palette of NHN Cloud Blue (#005EFF), vibrant cyan, and soft light blue. Features structured arrangements of technical elements like data nodes, server racks, cloud symbols, and digital interfaces. Minimalist aesthetic with geometric precision, balanced white space, professional IT and software development theme. Flat design with high-quality vector art.";
          break;
        case "아이소메트릭":
          stylePrompt = "Official NHN Cloud premium isometric style: a high-quality 3D isometric composition with strong depth and 45-degree perspective. Uses a sophisticated palette of NHN Cloud Blue (#005EFF), deep navy, and glowing cyan accents. Features clean, technical structures like futuristic server modules, floating data blocks, and holographic interfaces. Soft ambient occlusion, subtle neon glows on edges, and a clean matte finish. Professional IT infrastructure aesthetic, high-resolution 3D render, minimalist yet detailed.";
          break;
        default:
          stylePrompt = "A premium 3D voluminous, plump glass icon.";
      }

      const prompt = `${stylePrompt} The icon represents '${keyword}'. Isolated on pure white background, strictly NO shadows, strictly NO drop shadows, NO reflections on the ground, NO floor, NO background elements, strictly object only, high resolution, clean and professional.`;
      
      // Use 3.1 Flash Image for Pro mode, 2.5 for Standard
      const modelName = isProMode ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image';
      
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64Data = part.inlineData.data;
          const rawImageUrl = `data:image/png;base64,${base64Data}`;
          const processedUrl = await removeWhiteBackground(rawImageUrl);
          
          // 특정 인덱스의 카드에 이미지 저장
          setGeneratedCards(prev => {
            const next = [...prev];
            if (next[targetIdx]) {
              next[targetIdx] = { 
                ...next[targetIdx], 
                aiGeneratedImg: processedUrl, 
                imgScale: 1.0 
              };
            }
            return next;
          });
          break;
        }
      }
    } catch (error: any) {
      console.error("Icon Generation Error:", error);
      const errMsg = error.message || String(error);
      if (errMsg.includes("Requested entity was not found") || errMsg.includes("API_KEY_INVALID")) {
        setHasApiKey(false);
        setStatusMessage({ type: 'error', text: "API 키가 유효하지 않거나 설정이 필요합니다. 다시 설정해 주세요." });
      } else if (errMsg.includes("429") || errMsg.includes("quota")) {
        setStatusMessage({ type: 'error', text: "현재 AI 사용량이 많아 잠시 제한되었습니다. 약 30초 후에 다시 시도해 주세요!" });
      } else {
        setStatusMessage({ type: 'error', text: `이미지 생성 중 오류가 발생했습니다: ${errMsg}` });
      }
    } finally {
      setIsImgLoading(false);
    }
  };

  // --- 🪄 Real Gemini AI 이미지 생성 및 배경 제거 ---
  const removeWhiteBackground = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(base64);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // 흰색 배경 제거 (R, G, B가 모두 240 이상인 경우 투명화)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(base64);
    });
  };

  const handleGenerateAIImage = async () => {
    if (!imageKeyword.trim()) return;
    generateIcon(imageKeyword, currentCardIdx);
  };

  const handleRemoveBackground = async () => {
    const targetImg = currentCard.uploadedImg || currentCard.aiGeneratedImg;
    if (!targetImg) return;
    
    setStatusMessage({ type: 'info', text: "배경을 제거하고 있습니다..." });
    try {
      const processed = await removeWhiteBackground(targetImg);
      if (currentCard.uploadedImg) {
        updateCurrentCard({ uploadedImg: processed });
      } else {
        updateCurrentCard({ aiGeneratedImg: processed });
      }
      setStatusMessage({ type: 'info', text: "배경 제거 완료!" });
      setTimeout(() => setStatusMessage(null), 2000);
    } catch (err) {
      console.error("Remove Background Error:", err);
      setStatusMessage({ type: 'error', text: "배경 제거 중 오류가 발생했습니다." });
    }
  };

  // --- ✍️ [기능] 카피 자동 개선 (톤 변경) ---
  const handleRefineCopy = async (tone: string) => {
    if (!currentCard.title.trim() && !currentCard.content.trim()) {
      setStatusMessage({ type: 'error', text: "개선할 카피가 없습니다." });
      return;
    }
    const isIntro = currentCardIdx === 0;
    const maxTitleLines = isIntro ? 3 : 2;
    const maxContentLines = isIntro ? 3 : 4;

    setIsRefining(true);
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `다음 카드뉴스의 제목과 본문을 '${tone}' 스타일로 개선해줘.
        
        [카피 제작 가이드라인: NHN 카드뉴스 플레이북]
        ${COPY_PLAYBOOK}

        [현재 내용]
        제목: ${currentCard.title}
        본문: ${currentCard.content}
        
        [제약 사항]
        1. 제목: 반드시 ${maxTitleLines}줄 이내로 작성하고 각 줄은 줄바꿈(\\n)으로 구분.
        2. 본문: 반드시 ${maxContentLines}줄 이내로 작성하고 각 줄은 줄바꿈(\\n)으로 구분.
        3. 금지: #005EFF 같은 컬러 코드나 이모지 사용 금지.
        4. 스타일: '${tone}'의 톤앤매너를 확실히 살리되, 위 'NHN 카드뉴스 플레이북'의 프레임워크와 후킹 패턴을 적용하여 더 매력적으로 작성해줘.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING }
            },
            required: ["title", "content"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      if (result.title || result.content) {
        updateCurrentCard({
          title: result.title ? result.title.split("\n").slice(0, maxTitleLines).join("\n") : currentCard.title,
          content: result.content ? result.content.split("\n").slice(0, maxContentLines).join("\n") : currentCard.content
        });
      }
    } catch (error: any) {
      console.error("Refine Copy Error:", error);
      const errMsg = error.message || String(error);
      if (errMsg.includes("429") || errMsg.includes("quota")) {
        setStatusMessage({ type: 'error', text: "현재 AI 사용량이 많아 잠시 제한되었습니다. 약 30초 후에 다시 시도해 주세요!" });
      } else {
        setStatusMessage({ type: 'error', text: `카피 개선 중 오류가 발생했습니다: ${errMsg}` });
      }
    } finally {
      setIsRefining(false);
    }
  };

  const handleDownload = async (format: "png" | "jpg") => {
    if (isImgLoading) return;
    try {
      await document.fonts.ready;
      
      // 숨겨진 고해상도 카드 영역(allCardsRef)에서 현재 인덱스의 카드를 가져옴
      const cardElements = allCardsRef.current?.children;
      if (!cardElements || !cardElements[currentCardIdx]) {
        setStatusMessage({ type: 'error', text: "캡처할 요소를 찾을 수 없습니다." });
        return;
      }
      
      const element = cardElements[currentCardIdx] as HTMLElement;
      
      // 렌더링 안정화를 위한 대기
      await new Promise(resolve => setTimeout(resolve, 500));

      const options = {
        pixelRatio: downloadScale,
        backgroundColor: theme === 'light' ? "#ffffff" : theme === 'dark' ? "#111827" : "#005EFF",
        width: 1080,
        height: 1080,
        style: {
          transform: 'none',
        }
      };

      let dataUrl = '';
      if (format === 'png') {
        dataUrl = await htmlToImage.toPng(element, options);
      } else {
        dataUrl = await htmlToImage.toJpeg(element, { ...options, quality: 1.0 });
      }

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `NHN-Card-News-${currentCardIdx + 1}.${format}`;
      link.click();
    } catch (error) {
      console.error("Download Error:", error);
      setStatusMessage({ type: 'error', text: "이미지 저장 중 오류가 발생했습니다." });
    }
  };

  const handleDownloadAllPDF = async () => {
    if (generatedCards.length === 0 || isImgLoading || isPdfExporting) return;
    
    setIsPdfExporting(true);
    try {
      await document.fonts.ready;
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'px',
        format: [1080, 1080]
      });

      const cardElements = allCardsRef.current?.children;
      if (!cardElements) throw new Error("Card elements not found");

      for (let i = 0; i < generatedCards.length; i++) {
        const element = cardElements[i] as HTMLElement;
        // 각 카드 렌더링 대기
        await new Promise(resolve => setTimeout(resolve, 500));

        const dataUrl = await htmlToImage.toPng(element, {
          pixelRatio: downloadScale,
          backgroundColor: theme === 'light' ? "#ffffff" : theme === 'dark' ? "#111827" : "#005EFF",
          width: 1080,
          height: 1080,
          style: {
            transform: 'none',
          }
        });
        
        if (i > 0) pdf.addPage([1080, 1080], 'p');
        pdf.addImage(dataUrl, 'PNG', 0, 0, 1080, 1080);
      }

      pdf.save(`NHN-Card-News-All.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      setStatusMessage({ type: 'error', text: "PDF 생성 중 오류가 발생했습니다." });
    } finally {
      setIsPdfExporting(false);
    }
  };

  const handleGenerateHashtags = async () => {
    if (generatedCards.length === 0) return;
    setIsGeneratingHashtags(true);
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `다음 카드뉴스 내용을 바탕으로 인스타그램/링크드인에 올릴 만한 핵심 해시태그 10개를 뽑아줘. 
        [내용 요약]
        ${generatedCards.map(c => c.title).join(" / ")}
        
        [출력 형식]
        #태그1 #태그2 ... (한 줄로 출력)`,
      });
      setHashtags(response.text || "");
    } catch (error: any) {
      console.error("Hashtag Error:", error);
      const errMsg = error.message || String(error);
      setHashtags(`해시태그 생성 실패: ${errMsg}`);
    } finally {
      setIsGeneratingHashtags(false);
    }
  };

  // --- 🛠️ [기능] 카드 관리 (추가, 삭제, 복사, 순서 변경) ---
  const handleAddCard = () => {
    const newCard = {
      title: "새로운 카드 제목\n줄바꿈으로 구분",
      content: "새로운 카드 내용입니다.\n핵심 내용을 입력하세요.",
      iconKeyword: "Idea",
      visualType: 'icon' as const,
      aiGeneratedImg: null,
      uploadedImg: null,
      imgScale: 1.0
    };
    setGeneratedCards(prev => [...prev, newCard]);
    setCurrentCardIdx(generatedCards.length);
  };

  const handleDeleteCard = (idx: number) => {
    if (generatedCards.length <= 1) {
      setStatusMessage({ type: 'error', text: "최소 1장의 카드는 유지해야 합니다." });
      return;
    }
    setGeneratedCards(prev => prev.filter((_, i) => i !== idx));
    if (currentCardIdx >= idx && currentCardIdx > 0) {
      setCurrentCardIdx(currentCardIdx - 1);
    }
  };

  const handleCopyCard = (idx: number) => {
    const cardToCopy = { ...generatedCards[idx] };
    setGeneratedCards(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, cardToCopy);
      return next;
    });
    setCurrentCardIdx(idx + 1);
  };

  const handleReorderCards = (newOrder: typeof generatedCards) => {
    setGeneratedCards(newOrder);
    // 현재 선택된 카드가 어디로 갔는지 찾아서 인덱스 유지
    const currentCardData = generatedCards[currentCardIdx];
    const newIdx = newOrder.findIndex(c => c === currentCardData);
    if (newIdx !== -1) setCurrentCardIdx(newIdx);
  };

  if (view === "intro") {
    return (
      <div style={wrapStyle}>
        <style>{`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
          @import url('https://static.toastoven.net/static/fonts/nhnsans/nhnsans.css');
          
          body { font-family: 'Pretendard', sans-serif; margin: 0; }
        `}</style>
        
        <div style={{ marginBottom: '40px', marginTop: '60px' }}>
          <NHNCloudLogo color="white" scale={0.8} />
        </div>

        <div style={{ ...modalContent, width: '600px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '800', marginTop: '0px', color: 'white' }}>
              카드뉴스 자동 생성기 <span style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 'normal' }}>ver 1.2</span>
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '15px' }}>기사 링크나 텍스트를 입력하면 AI가 카드뉴스를 만들어드립니다.</p>
          </div>

          {/* 탭 메뉴 */}
          <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #3f4654' }}>
            <button 
              onClick={() => setSummaryMode("url")} 
              style={{ 
                ...tabBtn, 
                borderBottom: summaryMode === "url" ? '2px solid #6366f1' : 'none',
                color: summaryMode === "url" ? 'white' : '#94a3b8'
              }}
            >
              URL 입력
            </button>
            <button 
              onClick={() => setSummaryMode("text")} 
              style={{ 
                ...tabBtn, 
                borderBottom: summaryMode === "text" ? '2px solid #6366f1' : 'none',
                color: summaryMode === "text" ? 'white' : '#94a3b8'
              }}
            >
              텍스트 입력
            </button>
          </div>

          {summaryMode === "url" ? (
            <input 
              type="text"
              style={modalInput} 
              placeholder="기사 URL을 입력하세요 (예: https://news.naver.com/...)" 
              value={articleUrl} 
              onChange={(e) => setArticleUrl(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeArticle()}
            />
          ) : (
            <textarea 
              style={{ ...modalTextarea, height: '150px' }} 
              placeholder="뉴스 기사 내용을 붙여넣으세요..." 
              value={articleText} 
              onChange={(e) => setArticleText(e.target.value)} 
            />
          )}

          {/* 설정 모드 선택 */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
            <button 
              onClick={() => setConfigMode("auto")}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: configMode === "auto" ? '2px solid #6366f1' : '1px solid #3f4654',
                backgroundColor: configMode === "auto" ? 'rgba(99, 102, 241, 0.1)' : '#1e2530',
                color: configMode === "auto" ? 'white' : '#94a3b8',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: configMode === "auto" ? '#6366f1' : '#4b5563' }} />
              AI 자동 추천
            </button>
            <button 
              onClick={() => setConfigMode("manual")}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: configMode === "manual" ? '2px solid #6366f1' : '1px solid #3f4654',
                backgroundColor: configMode === "manual" ? 'rgba(99, 102, 241, 0.1)' : '#1e2530',
                color: configMode === "manual" ? 'white' : '#94a3b8',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: configMode === "manual" ? '#6366f1' : '#4b5563' }} />
              직접 설정
            </button>
          </div>

          {configMode === "manual" && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginBottom: '30px' }}>
                <label style={{ ...labelStyle, marginBottom: '15px' }}>원하는 톤앤매너 선택</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {[
                    "자동 분석 (기사 맞춤형)",
                    "기술 인사이트",
                    "프로모션 안내",
                    "보도자료 요약",
                    "교육센터 홍보"
                  ].map(tone => (
                    <button
                      key={tone}
                      onClick={() => setSelectedTone(tone)}
                      style={{
                        padding: '12px 5px',
                        borderRadius: '10px',
                        border: selectedTone === tone ? '2px solid #6366f1' : '1px solid #3f4654',
                        backgroundColor: selectedTone === tone ? 'rgba(99, 102, 241, 0.1)' : '#242a38',
                        color: selectedTone === tone ? 'white' : '#94a3b8',
                        fontSize: '13px',
                        cursor: 'pointer',
                        fontWeight: selectedTone === tone ? 'bold' : 'normal',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '30px' }}>
                <label style={{ ...labelStyle, marginBottom: '15px' }}>생성할 카드 장수</label>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  border: '1px solid #6366f1', 
                  borderRadius: '25px', 
                  height: '50px',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(99, 102, 241, 0.05)'
                }}>
                  <button 
                    onClick={() => setCardCount(Math.max(1, cardCount - 1))}
                    style={{ width: '60px', height: '100%', border: 'none', background: 'none', color: '#6366f1', fontSize: '24px', cursor: 'pointer', borderRight: '1px solid rgba(99, 102, 241, 0.2)' }}
                  >-</button>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#6366f1' }}>
                    {cardCount} 카드
                  </div>
                  <button 
                    onClick={() => setCardCount(Math.min(10, cardCount + 1))}
                    style={{ width: '60px', height: '100%', border: 'none', background: 'none', color: '#6366f1', fontSize: '24px', cursor: 'pointer', borderLeft: '1px solid rgba(99, 102, 241, 0.2)' }}
                  >+</button>
                </div>
              </div>
            </motion.div>
          )}

          {statusMessage && (
            <div style={{ 
              padding: '12px 15px', 
              borderRadius: '10px', 
              marginBottom: '20px', 
              fontSize: '14px',
              backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              color: statusMessage.type === 'error' ? '#ef4444' : '#818cf8',
              border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <Info size={18} />}
              <span style={{ flex: 1 }}>{statusMessage.text}</span>
              {statusMessage.type === 'error' && (
                <button 
                  onClick={() => setStatusMessage(null)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 5px' }}
                >✕</button>
              )}
            </div>
          )}

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleAnalyzeArticle()} 
            style={{ 
              ...analyzeBtn, 
              width: '100%', 
              padding: '18px', 
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              opacity: isAnalyzing ? 0.7 : 1,
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              pointerEvents: isAnalyzing ? 'none' : 'auto',
              position: 'relative'
            }} 
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw size={20} className="animate-spin" />
                기사 내용을 분석하고 있습니다...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                카드뉴스 생성하기
              </>
            )}
          </motion.button>

          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            marginTop: '12px', 
            padding: '8px 12px', 
            backgroundColor: 'rgba(99, 102, 241, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(99, 102, 241, 0.1)'
          }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#6366f1',
              boxShadow: '0 0 8px rgba(99, 102, 241, 0.5)'
            }} />
            <span style={{ fontSize: '12px', color: '#818cf8', fontWeight: '500' }}>
              NHN 카피 플레이북 적용됨 (AIDA, PAS, 4U 등)
            </span>
            <div style={{ marginLeft: 'auto', cursor: 'help', color: '#6366f1' }} title="AI가 NHN Cloud의 전문적인 카피 제작 가이드라인을 준수하여 결과물을 생성합니다.">
              <Info size={14} />
            </div>
          </div>

          {/* 개인 API 키 입력 섹션 */}
          <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #3f4654' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: isProMode ? '#60a5fa' : '#94a3b8', fontSize: '14px', fontWeight: 'bold' }}>
                  {isProMode ? '🚀 Pro 모드 (고급형)' : '⚡ Standard 모드 (일반형)'}
                </span>
                <button 
                  onClick={() => setIsProMode(!isProMode)}
                  style={{
                    width: '40px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: isProMode ? '#2563eb' : '#475569',
                    position: 'relative',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.3s'
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: isProMode ? '22px' : '2px',
                    transition: 'all 0.3s'
                  }} />
                </button>
              </div>
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                키 발급받기 <ExternalLink size={12} />
              </a>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label style={{ ...labelStyle, marginBottom: 0, fontSize: '13px', color: isProMode && !userApiKey ? '#f87171' : '#94a3b8' }}>
                {isProMode ? 
                  (userApiKey ? '✨ Gemini 3.1 Pro 및 초고화질 이미지 모델이 적용 중입니다.' : '⚠️ Pro 모드 사용을 위해 API 키를 입력해주세요.') : 
                  '더 높은 퀄리티의 카피와 초고화질 이미지를 원하시면 Pro 모드를 켜주세요.'}
              </label>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type="password"
                placeholder="Gemini API Key를 입력하세요"
                value={userApiKey}
                onChange={(e) => handleSaveUserKey(e.target.value)}
                style={{
                  ...modalInput,
                  marginBottom: 0,
                  fontSize: '13px',
                  paddingRight: '100px',
                  backgroundColor: userApiKey ? 'rgba(16, 185, 129, 0.05)' : '#1e2530',
                  borderColor: userApiKey ? '#10b981' : '#3f4654'
                }}
              />
              {userApiKey && (
                <div style={{ 
                  position: 'absolute', 
                  right: '8px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{ 
                    color: '#10b981',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Check size={14} /> 연결됨
                  </div>
                  <button 
                    onClick={() => handleSaveUserKey("")}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      color: '#ef4444',
                      padding: '4px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="키 삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isFirstPage = currentCardIdx === 0;
  const isLastPage = generatedCards.length > 1 && currentCardIdx === generatedCards.length - 1;
  const isMiddlePage = !isFirstPage && !isLastPage;

  if (isKeyChecking) return null;

  if (!hasApiKey && !skipKeySelection) {
    return (
      <div style={{ 
        height: '100vh', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white',
        fontFamily: 'Pretendard, sans-serif', padding: '20px', textAlign: 'center'
      }}>
        <NHNCloudLogo color="white" />
        <div style={{ marginTop: '40px', maxWidth: '500px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '16px' }}>고성능 AI 모델로 퀄리티를 높여보세요</h2>
          
          {/* Pro 모드 선택 토글 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '15px', 
            marginBottom: '24px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            padding: '12px',
            borderRadius: '12px',
            border: isProMode ? '1px solid #2563eb' : '1px solid #334155'
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: isProMode ? '#60a5fa' : '#94a3b8', fontSize: '15px', fontWeight: 'bold' }}>
                {isProMode ? '🚀 Pro 모드 활성화' : '⚡ Standard 모드 사용 중'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {isProMode ? 'Pro 모델은 개인 API 키가 반드시 필요합니다.' : 'Standard 모델은 API 키 없이도 이용 가능합니다.'}
              </div>
            </div>
            <button 
              onClick={() => setIsProMode(!isProMode)}
              style={{
                width: '50px',
                height: '26px',
                borderRadius: '13px',
                backgroundColor: isProMode ? '#2563eb' : '#475569',
                position: 'relative',
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.3s',
                flexShrink: 0
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: 'white',
                position: 'absolute',
                top: '3px',
                left: isProMode ? '27px' : '3px',
                transition: 'all 0.3s'
              }} />
            </button>
          </div>

          <p style={{ color: '#94a3b8', marginBottom: '24px', lineHeight: '1.6' }}>
            {isProMode 
              ? 'Pro 모드에서는 최신 Gemini 1.5 Pro 모델을 사용하여 더 정교한 카피와 고해상도 이미지를 생성합니다.'
              : 'Standard 모드에서는 Flash 모델을 사용하여 빠르고 효율적으로 카드뉴스를 생성합니다.'}
          </p>

          {/* 친절한 설명 박스 */}
          <div style={{ 
            backgroundColor: 'rgba(99, 102, 241, 0.1)', 
            border: '1px solid rgba(99, 102, 241, 0.2)', 
            borderRadius: '12px', 
            padding: '16px', 
            marginBottom: '32px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <Info size={18} color="#818cf8" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#818cf8' }}>왜 개인 API 키가 필요한가요?</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '28px', fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
              <li><strong>무료로 시작 가능:</strong> Google AI Studio에서 무료 티어로 키를 발급받아 바로 사용할 수 있습니다.</li>
              <li><strong>보안 보장:</strong> 입력하신 키는 사용자의 브라우저에만 안전하게 저장되며, 절대 서버로 전송되지 않습니다.</li>
              <li><strong>고퀄리티 보장:</strong> 공유용 무료 모델보다 훨씬 강력한 분석력과 이미지 생성 능력을 경험할 수 있습니다.</li>
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              onClick={handleOpenKeySelector}
              style={{
                padding: '14px 28px', backgroundColor: '#6366f1', color: 'white',
                border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
              }}
            >
              <Zap size={20} /> API 키 설정하고 시작하기 (권장)
            </button>
            <button 
              onClick={handleSkipKey}
              disabled={isProMode}
              style={{
                padding: '14px 28px', 
                backgroundColor: 'transparent', 
                color: isProMode ? '#475569' : '#94a3b8',
                border: isProMode ? '1px solid #1e293b' : '1px solid #334155', 
                borderRadius: '12px', fontSize: '15px', fontWeight: '500',
                cursor: isProMode ? 'not-allowed' : 'pointer',
                opacity: isProMode ? 0.5 : 1
              }}
            >
              {isProMode ? 'Pro 모드는 API 키가 필요합니다' : '나중에 하기 (무료 모델로 계속)'}
            </button>
          </div>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ display: 'block', marginTop: '24px', color: '#6366f1', fontSize: '14px', textDecoration: 'none' }}
          >
            결제 설정 안내 보기 <ExternalLink size={14} style={{ verticalAlign: 'middle' }} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <style>{`
        @import url('https://static.toastoven.net/static/fonts/nhnsans/nhnsans.css');
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
        
        body { 
          font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif; 
          margin: 0; 
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        input[type=range] { width: 100%; cursor: pointer; accent-color: #2563eb; }
      `}</style>

      {/* AI 요약 모달 */}
      {isModalOpen && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ margin: "0 0 20px 0", color: 'white' }}>AI 기사 요약</h3>
            
            {/* 탭 메뉴 */}
            <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #3f4654' }}>
              <button 
                onClick={() => setSummaryMode("text")} 
                style={{ 
                  ...tabBtn, 
                  borderBottom: summaryMode === "text" ? '2px solid #6366f1' : 'none',
                  color: summaryMode === "text" ? 'white' : '#94a3b8'
                }}
              >
                텍스트 입력
              </button>
              <button 
                onClick={() => setSummaryMode("url")} 
                style={{ 
                  ...tabBtn, 
                  borderBottom: summaryMode === "url" ? '2px solid #6366f1' : 'none',
                  color: summaryMode === "url" ? 'white' : '#94a3b8'
                }}
              >
                URL 입력
              </button>
            </div>

            {summaryMode === "text" ? (
              <textarea 
                style={modalTextarea} 
                placeholder="뉴스 기사 내용을 붙여넣으세요..." 
                value={articleText} 
                onChange={(e) => setArticleText(e.target.value)} 
              />
            ) : (
              <input 
                type="text"
                style={modalInput} 
                placeholder="기사 URL을 입력하세요 (예: https://news.naver.com/...)" 
                value={articleUrl} 
                onChange={(e) => setArticleUrl(e.target.value)} 
              />
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setIsModalOpen(false)} style={{ ...analyzeBtn, background: '#4b5563' }}>닫기</button>
                <button onClick={handleAnalyzeArticle} style={{ ...analyzeBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        분석 중...
                      </>
                    ) : "카드뉴스 생성하기"}
                </button>
            </div>
          </div>
        </div>
      )}

      <header style={headerSection}>
        <div style={{ position: 'absolute', left: '40px', top: '40px' }}>
          <button 
            onClick={() => setView("intro")} 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: 'white', 
              padding: '12px', 
              borderRadius: '12px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            title="처음으로 돌아가기"
          >
            <ArrowLeft size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '10px' }}>
          <h1 style={{ ...headerMainTitle, marginBottom: 0 }}>NHN클라우드 카드뉴스 제작 툴</h1>
        </div>
      </header>

      {generatedCards.length > 0 && (
        <div style={{ 
          marginBottom: '40px', 
          background: '#1e2530', 
          padding: '16px 20px', 
          borderRadius: '16px', 
          border: '1px solid #2d333f',
          maxWidth: '1250px',
          width: '95%',
          boxSizing: 'border-box',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: 'white', fontSize: '16px', fontWeight: '800' }}>카드 순서</span>
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>드래그하여 순서 변경</span>
            </div>
            <button 
              onClick={handleAddCard}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                backgroundColor: '#6366f1', 
                color: 'white', 
                border: 'none', 
                padding: '8px 16px', 
                borderRadius: '10px', 
                fontSize: '13px', 
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
              }}
            >
              <Plus size={16} /> 카드 추가
            </button>
          </div>
          
          <Reorder.Group 
            axis="x" 
            values={generatedCards} 
            onReorder={handleReorderCards} 
            style={{ 
              display: 'flex', 
              gap: '10px', 
              overflowX: 'auto', 
              padding: '4px 10px 16px 10px', 
              listStyle: 'none', 
              margin: 0, 
              scrollbarWidth: 'thin',
              scrollbarColor: '#475569 transparent',
              WebkitOverflowScrolling: 'touch',
              flexWrap: 'nowrap'
            }}
          >
            {generatedCards.map((card, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === generatedCards.length - 1;
              const isSelected = currentCardIdx === idx;
              
              let cardBg = isSelected ? 'rgba(99, 102, 241, 0.3)' : '#334155';
              let cardBorder = isSelected ? '2px solid #818cf8' : '1px solid #475569';
              
              if (!isSelected) {
                if (isFirst) {
                  cardBg = 'rgba(37, 99, 235, 0.2)';
                  cardBorder = '1px solid rgba(37, 99, 235, 0.5)';
                } else if (isLast) {
                  cardBg = 'rgba(147, 51, 234, 0.2)';
                  cardBorder = '1px solid rgba(147, 51, 234, 0.5)';
                }
              }

              return (
                <Reorder.Item 
                  key={idx} 
                  value={card}
                  style={{ flexShrink: 0 }}
                >
                  <div 
                    onClick={() => handleSwitchCard(idx)}
                    style={{
                      width: '70px',
                      height: '54px',
                      borderRadius: '12px',
                      backgroundColor: cardBg,
                      border: cardBorder,
                      cursor: 'pointer',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 4px 20px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                  >
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '6px', 
                      backgroundColor: isSelected ? '#6366f1' : (isFirst ? '#2563eb' : (isLast ? '#9333ea' : '#475561')),
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '4px',
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleCopyCard(idx); }}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', borderRadius: '4px', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        title="복사"
                      >
                        <Copy size={12} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteCard(idx); }}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', borderRadius: '4px', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                        title="삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
        </div>
      )}

      <div style={mainLayout}>
        <div style={leftPanel}>
          {/* 카피 개선 섹션 (상단으로 이동) */}
          <div style={{ ...inputItem, marginBottom: '25px', padding: '20px', backgroundColor: 'rgba(168, 85, 247, 0.05)', borderRadius: '16px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <label style={{ ...labelStyle, color: '#a855f7', marginBottom: 0 }}>✨ 전체 카피 스타일 변경 (재생성)</label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {[
                "기술 인사이트",
                "프로모션 안내",
                "보도자료 요약",
                "교육센터 홍보"
              ].map((tone) => (
                <button 
                  key={tone} 
                  onClick={() => {
                    setSelectedTone(tone);
                    handleAnalyzeArticle(tone);
                  }} 
                  style={{ 
                    ...refineBtn, 
                    padding: '12px 4px', 
                    fontSize: '13px',
                    backgroundColor: selectedTone === tone ? '#a855f7' : '#242a38',
                    color: 'white',
                    border: 'none',
                    boxShadow: selectedTone === tone ? '0 4px 12px rgba(168, 85, 247, 0.4)' : 'none'
                  }}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing && selectedTone === tone ? "생성 중..." : tone}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '10px', textAlign: 'center' }}>
              * 버튼 클릭 시 선택한 스타일로 전체 카드가 다시 생성됩니다.
            </p>
          </div>

          {/* 제목 섹션 */}
          <div style={inputItem}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={labelStyle}>제목 (최대 {currentCardIdx === 0 ? 3 : 2}줄)</label>
              {currentCardIdx !== 0 && (
                <div 
                  style={{ position: 'relative', fontSize: '12px', color: '#94a3b8', cursor: 'help', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onMouseEnter={() => setShowHighlightGuideTitle(true)}
                  onMouseLeave={() => setShowHighlightGuideTitle(false)}
                >
                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>?</span>
                  텍스트 강조 방법
                  {showHighlightGuideTitle && (
                    <div style={{
                      position: 'absolute', right: 0, top: '25px', width: '220px',
                      backgroundColor: '#1e293b', color: '#fff', padding: '12px', borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.3)', zIndex: 100, fontSize: '11px', lineHeight: '1.6',
                      border: '1px solid #334155'
                    }}>
                      오른쪽 미리보기 화면에서 강조하고 싶은 단어를 <strong>마우스로 드래그</strong>하세요.
                    </div>
                  )}
                </div>
              )}
            </div>
            <textarea 
              style={textareaStyle} 
              value={currentCard.title.replace(/\*\*/g, '')} 
              data-field="title"
              placeholder="제목을 입력하세요."
              onChange={(e) => {
                const text = e.target.value;
                const lines = text.split("\n");
                const maxLines = currentCardIdx === 0 ? 3 : 2;
                const val = lines.length <= maxLines ? text : lines.slice(0, maxLines).join("\n");
                updateCurrentCard({ title: val });
              }} 
            />
          </div>

          {/* 내용 섹션 */}
          <div style={inputItem}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={labelStyle}>
                {currentCardIdx === generatedCards.length - 1 ? "CTA" : `내용 (최대 ${currentCardIdx === 0 ? 3 : 4}줄)`}
              </label>
              <div 
                style={{ position: 'relative', fontSize: '12px', color: '#94a3b8', cursor: 'help', display: 'flex', alignItems: 'center', gap: '4px' }}
                onMouseEnter={() => setShowHighlightGuideContent(true)}
                onMouseLeave={() => setShowHighlightGuideContent(false)}
              >
                <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid #94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>?</span>
                텍스트 강조 방법
                {showHighlightGuideContent && (
                  <div style={{
                    position: 'absolute', right: 0, top: '25px', width: '220px',
                    backgroundColor: '#1e293b', color: '#fff', padding: '12px', borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)', zIndex: 100, fontSize: '11px', lineHeight: '1.6',
                    border: '1px solid #334155'
                  }}>
                    오른쪽 미리보기 화면에서 강조하고 싶은 단어를 <strong>마우스로 드래그</strong>하세요.
                  </div>
                )}
              </div>
            </div>
            <textarea 
              style={{ ...textareaStyle, height: '100px' }} 
              value={currentCard.content.replace(/\*\*/g, '')} 
              data-field="content"
              placeholder="내용을 입력하세요."
              onChange={(e) => {
                const text = e.target.value;
                const lines = text.split("\n");
                const maxLines = currentCardIdx === 0 ? 3 : 4;
                const val = lines.length <= maxLines ? text : lines.slice(0, maxLines).join("\n");
                updateCurrentCard({ content: val });
              }} 
            />
          </div>

          {/* 카피 개선 섹션 (삭제됨 - 상단으로 이동) */}

          {/* 이미지 섹션 */}
          {!isLastPage && (
            <div style={{ ...inputItem, borderTop: '1px solid #334155', paddingTop: '28px' }}>
              <label style={{ ...labelStyle, marginBottom: '15px' }}>이미지 삽입 및 조절</label>
              
              {/* 탭 메뉴 */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '15px', backgroundColor: '#1e2530', padding: '4px', borderRadius: '10px' }}>
                <button 
                  onClick={() => setImageTab('ai')}
                  style={{ 
                    flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold',
                    backgroundColor: imageTab === 'ai' ? '#334155' : 'transparent',
                    color: imageTab === 'ai' ? '#fff' : '#94a3b8',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  AI 생성
                </button>
                <button 
                  onClick={() => setImageTab('upload')}
                  style={{ 
                    flex: 1, padding: '8px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold',
                    backgroundColor: imageTab === 'upload' ? '#334155' : 'transparent',
                    color: imageTab === 'upload' ? '#fff' : '#94a3b8',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  직접 업로드
                </button>
              </div>

              {imageTab === 'ai' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* 스타일 칩 */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {["글래스모피즘", "심플아이콘", "일러스트레이션", "아이소메트릭"].map((style) => (
                      <button 
                        key={style} 
                        onClick={() => setSelectedImageStyle(style)}
                        style={{ 
                          padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '500',
                          backgroundColor: selectedImageStyle === style ? 'rgba(99, 102, 241, 0.2)' : '#242a38',
                          border: selectedImageStyle === style ? '1px solid #6366f1' : '1px solid #3f4654',
                          color: selectedImageStyle === style ? 'white' : '#94a3b8',
                          cursor: 'pointer'
                        }}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                  {/* 입력창 + 버튼 */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      style={{ ...imageInputStyle, width: '100%', paddingRight: '70px' }} 
                      placeholder="AI 이미지 검색어" 
                      value={imageKeyword} 
                      onChange={(e) => setImageKeyword(e.target.value)} 
                    />
                    <button 
                      onClick={handleGenerateAIImage} 
                      style={{ 
                        position: 'absolute', right: '5px', height: '30px', padding: '0 12px',
                        backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '6px',
                        fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                      }} 
                      disabled={isImgLoading}
                    >
                      {isImgLoading ? "..." : "생성"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ ...uploadButtonStyle, width: '100%', margin: 0 }}>📁 사진 업로드<input type="file" accept="image/*, .svg, image/svg+xml" style={{ display: 'none' }} onChange={handleFileUpload} /></label>
                </div>
              )}

              {/* 상태 표시 및 삭제 */}
              {(currentCard.uploadedImg || currentCard.aiGeneratedImg) && (
                <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {currentCard.uploadedImg ? (
                      <><Check size={14} color="#22c55e" /><span style={{ fontSize: '12px', color: '#22c55e' }}>업로드 이미지 적용 중</span></>
                    ) : (
                      <><Sparkles size={14} color="#6366f1" /><span style={{ fontSize: '12px', color: '#6366f1' }}>AI 생성 이미지 적용 중</span></>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => updateCurrentCard({ uploadedImg: null, aiGeneratedImg: null })}
                      style={{ backgroundColor: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                    >
                      제거
                    </button>
                  </div>
                </div>
              )}

              {/* 조절 섹션 */}
              {(currentCard.uploadedImg || currentCard.aiGeneratedImg) && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
                  <div style={scaleControlBox}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>크기 조절</span>
                      <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>{Math.round((currentCard.imgScale || 1.0) * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.05" 
                      value={currentCard.imgScale || 1.0} 
                      onChange={(e) => updateCurrentCard({ imgScale: parseFloat(e.target.value) })} 
                      style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
                    />
                  </div>

                  <div style={{ marginTop: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '10px' }}>위치 조절</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button onClick={() => updateCurrentCard({ imgOffsetX: (currentCard.imgOffsetX || 0) - 10 })} style={posBtnStyle} title="왼쪽으로 이동"><ArrowLeft size={14} /></button>
                      <button onClick={() => updateCurrentCard({ imgOffsetY: (currentCard.imgOffsetY || 0) - 10 })} style={posBtnStyle} title="위쪽으로 이동"><ArrowUp size={14} /></button>
                      <button onClick={() => updateCurrentCard({ imgOffsetY: (currentCard.imgOffsetY || 0) + 10 })} style={posBtnStyle} title="아래쪽으로 이동"><ArrowDown size={14} /></button>
                      <button onClick={() => updateCurrentCard({ imgOffsetX: (currentCard.imgOffsetX || 0) + 10 })} style={posBtnStyle} title="오른쪽으로 이동"><ArrowRight size={14} /></button>
                      <button 
                        onClick={() => updateCurrentCard({ imgOffsetX: 0, imgOffsetY: 0 })} 
                        style={{ ...posBtnStyle, width: 'auto', padding: '0 12px', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        중앙 정렬
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      {/* 오른쪽 미리보기 */}
        <div style={rightArea}>
          <h2 style={previewTitle}>미리보기</h2>
          <div style={previewContainer}>
            <div style={{ transform: "scale(0.55)", transformOrigin: "top left" }}>
              <div ref={cardRef} style={{
                ...cardCanvas,
                padding: 0,
                transform: "none", // 캡처를 위해 실제 요소는 transform 제거
                background: theme === 'light' 
                  ? "linear-gradient(to bottom, #ffffff 0%, #e8f2ff 100%)" 
                  : theme === 'dark' 
                    ? "#111827" 
                    : "linear-gradient(135deg, #005EFF 0%, #00B2FF 100%)",
                color: theme === 'light' ? "#111" : "#fff"
              }}>
                {/* 레이아웃 분기 처리 */}
                {isLastPage ? (
                  // --- [마지막 장: Closing CTA 레이아웃] ---
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start',
                    padding: '80px 80px', boxSizing: 'border-box'
                  }}>
                    {/* 로고 상단 고정 */}
                    <div style={logoWrapper}>
                      <NHNCloudLogo color={theme === 'light' ? "#191919" : "white"} />
                    </div>

                    {/* 제목 (중간 장표와 동일하게 강조 처리) */}
                    <div 
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      data-editable-field="title"
                      onMouseUp={(e) => handleTextMouseUp(e, 'title')}
                      onInput={(e) => updateCurrentCard({ title: e.currentTarget.innerText })}
                      style={{ 
                        ...cardTitleStyle,
                        fontSize: '62px',
                        color: theme === 'light' ? '#333' : '#fff',
                        outline: 'none',
                        cursor: 'text',
                        transition: 'background-color 0.2s',
                        borderRadius: '8px',
                        marginBottom: '32px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {renderEmphasizedText(currentCard.title, 'title')}
                    </div>
  
                    {/* CTA 텍스트 */}
                    <div style={{
                      fontSize: '34px',
                      fontWeight: '600',
                      color: theme === 'light' ? '#666' : '#ccc',
                      fontFamily: 'Pretendard, sans-serif',
                      letterSpacing: '-1px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      ( 🔗 포스팅 본문 링크 참조 )
                    </div>
                  </div>
                ) : isMiddlePage ? (
                  // --- [중간 장: Frame-2 데이터 시각화 레이아웃] ---
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start',
                    padding: '80px 80px', boxSizing: 'border-box'
                  }}>
                    {/* 로고 */}
                    <div style={logoWrapper}>
                      <NHNCloudLogo color={theme === 'light' ? "#191919" : "white"} />
                    </div>

                    <div 
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      data-editable-field="title"
                      onMouseUp={(e) => handleTextMouseUp(e, 'title')}
                      onInput={(e) => updateCurrentCard({ title: e.currentTarget.innerText })}
                      style={{ 
                        ...cardTitleStyle,
                        fontSize: '67px',
                        marginTop: '104px',
                        color: theme === 'light' ? '#333' : '#fff',
                        outline: 'none',
                        cursor: 'text',
                        transition: 'background-color 0.2s',
                        borderRadius: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {renderEmphasizedText(currentCard.title, 'title')}
                    </div>
                    <div 
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      data-editable-field="content"
                      onMouseUp={(e) => handleTextMouseUp(e, 'content')}
                      onInput={(e) => updateCurrentCard({ content: e.currentTarget.innerText })}
                      style={{ 
                        ...cardContentStyle,
                        color: theme === 'light' ? '#333' : '#fff',
                        outline: 'none',
                        cursor: 'text',
                        transition: 'background-color 0.2s',
                        borderRadius: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {renderEmphasizedText(currentCard.content, 'content')}
                    </div>
                    
                    {/* [요청 반영] 시각 요소 영역 (우하단 배치, 여백 30px, 크기 20% 확대) */}
                    <div style={{ 
                      position: 'absolute', 
                      right: '40px', 
                      bottom: currentCardIdx === 0 ? '30px' : '40px', 
                      maxWidth: '520px', 
                      maxHeight: '520px', 
                      display: 'flex', 
                      alignItems: 'flex-end', 
                      justifyContent: 'flex-end',
                      zIndex: 5,
                      pointerEvents: 'none'
                    }}>
                      {isImgLoading ? (
                        <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          <Loader2 className="animate-spin" size={20} color="#6366f1" />
                          <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 'bold' }}>이미지 생성 중</span>
                        </div>
                      ) : currentCard.uploadedImg || currentCard.aiGeneratedImg ? (
                        <div style={{ 
                          position: 'relative', 
                          display: 'flex', 
                          alignItems: 'flex-end', 
                          justifyContent: 'flex-end' 
                        }}>
                          {currentCard.uploadedImg ? (
                            <img 
                              src={currentCard.uploadedImg} 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '100%', 
                                objectFit: 'contain', 
                                display: 'block',
                                transform: `scale(${currentCard.imgScale || 1.0}) translate(${currentCard.imgOffsetX || 0}px, ${currentCard.imgOffsetY || 0}px)`,
                                transformOrigin: 'bottom right' 
                              }} 
                              alt="Custom" 
                              referrerPolicy="no-referrer" 
                            />
                          ) : (
                            <img 
                              src={currentCard.aiGeneratedImg!} 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '100%', 
                                objectFit: 'contain', 
                                display: 'block',
                                transform: `scale(${currentCard.imgScale || 1.0}) translate(${currentCard.imgOffsetX || 0}px, ${currentCard.imgOffsetY || 0}px)`,
                                transformOrigin: 'bottom right', 
                                filter: theme === 'blue' ? 'brightness(1.5)' : 'none'
                              }} 
                              alt="AI" 
                              referrerPolicy="no-referrer" 
                            />
                          )}
                        </div>
                      ) : (currentCard.visualType === 'chart' || currentCard.visualType === 'diagram') && currentCard.visualData ? (
                        <div style={{ 
                          width: '450px', 
                          height: '400px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          transform: `scale(${currentCard.imgScale || 1.0})`,
                          transformOrigin: 'bottom right',
                          pointerEvents: 'auto'
                        }}>
                          {currentCard.visualType === 'chart' ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={currentCard.visualData.map((item: any) => {
                                if (typeof item === 'string' && item.includes(':')) {
                                  const [name, value] = item.split(':');
                                  return { name, value: parseFloat(value) || 0 };
                                }
                                return { name: String(item), value: 0 };
                              })}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'light' ? '#e2e8f0' : '#334155'} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: 12 }} />
                                <YAxis hide />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                  itemStyle={{ color: '#005EFF', fontWeight: 'bold' }}
                                />
                                <Bar dataKey="value" fill="#005EFF" radius={[4, 4, 0, 0]} barSize={40} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                              {currentCard.visualData.map((step: string, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <div style={{ 
                                    width: '40px', height: '40px', borderRadius: '50%', 
                                    backgroundColor: '#005EFF', color: 'white', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: '800', fontSize: '18px'
                                  }}>
                                    {i + 1}
                                  </div>
                                  <div style={{ 
                                    flex: 1, padding: '12px 20px', borderRadius: '12px',
                                    backgroundColor: theme === 'light' ? 'rgba(0,94,255,0.05)' : 'rgba(255,255,255,0.1)',
                                    color: theme === 'light' ? '#1e293b' : '#fff',
                                    fontSize: '18px', fontWeight: '600'
                                  }}>
                                    {step}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  // --- [첫 장: Frame-0 메인 타이틀 레이아웃] ---
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start',
                    padding: '80px 80px', boxSizing: 'border-box'
                  }}>
                    {/* 로고 */}
                    <div style={logoWrapper}>
                      <NHNCloudLogo color={theme === 'light' ? "#191919" : "white"} />
                    </div>

                    <div 
                      contentEditable={currentCardIdx !== 0}
                      suppressContentEditableWarning={true}
                      data-editable-field="title"
                      onMouseUp={(e) => currentCardIdx !== 0 && handleTextMouseUp(e, 'title')}
                      onInput={(e) => updateCurrentCard({ title: e.currentTarget.innerText })}
                      style={{ 
                        ...cardTitleStyle,
                        fontSize: '86px',
                        marginTop: '104px',
                        background: "linear-gradient(to bottom, #06BFF7 0%, #001AFF 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        letterSpacing: '-3px',
                        outline: 'none',
                        cursor: currentCardIdx === 0 ? 'default' : 'text',
                        transition: 'background-color 0.2s',
                        borderRadius: '8px'
                      }}
                      onMouseEnter={(e) => {
                        if (currentCardIdx !== 0) {
                          e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)';
                        }
                      }}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {currentCardIdx === 0 ? currentCard.title : renderEmphasizedText(currentCard.title, 'title')}
                    </div>
                    <div 
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      data-editable-field="content"
                      onMouseUp={(e) => handleTextMouseUp(e, 'content')}
                      onInput={(e) => updateCurrentCard({ content: e.currentTarget.innerText })}
                      style={{ 
                        ...cardContentStyle,
                        color: theme === 'light' ? '#333' : '#fff',
                        outline: 'none',
                        cursor: 'text',
                        transition: 'background-color 0.2s',
                        borderRadius: '8px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {renderEmphasizedText(currentCard.content, 'content')}
                    </div>
                    <div style={decoArea}>
                      {(selectedImageStyle === "글래스모피즘" && !currentCard.uploadedImg && currentCard.aiGeneratedImg) && (
                        <>
                          <div style={{ ...decoBlueCircle, backgroundColor: theme === 'blue' ? 'rgba(255,255,255,0.2)' : '#2563eb' }}></div>
                          <div style={decoCyanDot}></div>
                          <div style={decoGradCircle}></div>
                        </>
                      )}
                      <div style={aiImageWrapper}>
                        {isImgLoading ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', paddingBottom: '40px' }}>
                            <Loader2 className="animate-spin" size={48} color="#6366f1" />
                            <span style={{ fontSize: '14px', color: '#6366f1', fontWeight: 'bold' }}>이미지 생성 중...</span>
                          </div>
                        ) : currentCard.uploadedImg ? (
                          <img src={currentCard.uploadedImg} style={{ ...customImgElement, transform: `scale(${currentCard.imgScale || 1.0}) translate(${currentCard.imgOffsetX || 0}px, ${currentCard.imgOffsetY || 0}px)` }} alt="Custom" referrerPolicy="no-referrer" />
                        ) : currentCard.aiGeneratedImg ? (
                          <img src={currentCard.aiGeneratedImg} style={{ ...aiImgElement, transform: `scale(${currentCard.imgScale || 1.0}) translate(${currentCard.imgOffsetX || 0}px, ${currentCard.imgOffsetY || 0}px)`, filter: theme === 'blue' ? 'brightness(1.5)' : 'none' }} alt="AI" referrerPolicy="no-referrer" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 미리보기 하단 다운로드 버튼 */}
              <div style={{ marginTop: '50px', display: 'flex', flexDirection: 'column', gap: '16px', width: '1080px' }}>
                {/* 해상도 선택 옵션 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', backgroundColor: '#1e2530', padding: '12px 20px', borderRadius: '12px', border: '1px solid #3f4654', width: 'fit-content' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#94a3b8' }}>다운로드 해상도:</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2].map(s => (
                      <button 
                        key={s}
                        onClick={() => setDownloadScale(s)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          border: downloadScale === s ? '2px solid #0ea5e9' : '1px solid #3f4654',
                          backgroundColor: downloadScale === s ? 'rgba(14, 165, 233, 0.1)' : '#242a38',
                          color: downloadScale === s ? '#0ea5e9' : '#94a3b8'
                        }}
                      >
                        {s}배수 {s === 2 && '(고화질)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={() => handleDownload("png")} 
                    style={{ 
                      flex: 1,
                      background: '#0ea5e9', 
                      color: 'white', 
                      border: 'none', 
                      padding: '16px', 
                      borderRadius: '16px', 
                      fontSize: '18px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)'
                    }}
                  >
                    <Download size={20} /> PNG 다운로드
                  </button>
                  <button 
                    onClick={() => handleDownload("jpg")} 
                    style={{ 
                      flex: 1,
                      background: '#38bdf8', 
                      color: 'white', 
                      border: 'none', 
                      padding: '16px', 
                      borderRadius: '16px', 
                      fontSize: '18px', 
                      fontWeight: 'bold', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      boxShadow: '0 4px 12px rgba(56, 189, 248, 0.2)'
                    }}
                  >
                    <Download size={20} /> JPG 다운로드
                  </button>
                </div>
                <button 
                  onClick={handleDownloadAllPDF} 
                  style={{ 
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
                    color: 'white', 
                    border: 'none', 
                    padding: '18px', 
                    borderRadius: '16px', 
                    fontSize: '20px', 
                    fontWeight: 'bold', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
                  }}
                  disabled={isPdfExporting}
                >
                  {isPdfExporting ? (
                    <><RefreshCw size={24} className="animate-spin" /> PDF 생성 중...</>
                  ) : (
                    <><FileText size={24} /> 전체 PDF 다운로드</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 아이템 수정 모달 */}
      {editingChartItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '24px',
            borderRadius: '16px',
            width: '320px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            border: '1px solid #334155'
          }}>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px', fontWeight: 'bold' }}>
              {editingChartItem.type === 'label' ? '항목 이름 수정' : '데이터 값 수정'}
            </h3>
            
            {editingChartItem.type === 'label' ? (
              <input 
                autoFocus
                style={{ ...imageInputStyle, width: '100%', marginBottom: '20px' }}
                value={(() => {
                  const item = currentCard.visualData[editingChartItem.idx];
                  if (typeof item === 'string' && item.includes(':')) {
                    return item.split(':')[0];
                  }
                  return String(item);
                })()}
                onChange={(e) => {
                  const newData = [...currentCard.visualData];
                  const item = newData[editingChartItem.idx];
                  if (typeof item === 'string' && item.includes(':')) {
                    const parts = item.split(':');
                    newData[editingChartItem.idx] = `${e.target.value}:${parts[1]}`;
                  } else {
                    newData[editingChartItem.idx] = e.target.value;
                  }
                  updateCurrentCard({ visualData: newData });
                }}
              />
            ) : (
              <input 
                autoFocus
                type="number"
                style={{ ...imageInputStyle, width: '100%', marginBottom: '20px' }}
                value={(() => {
                  const item = currentCard.visualData[editingChartItem.idx];
                  if (typeof item === 'string' && item.includes(':')) {
                    return item.split(':')[1];
                  }
                  return parseFloat(item) || 0;
                })()}
                onChange={(e) => {
                  const newData = [...currentCard.visualData];
                  const item = newData[editingChartItem.idx];
                  if (typeof item === 'string' && item.includes(':')) {
                    const parts = item.split(':');
                    newData[editingChartItem.idx] = `${parts[0]}:${e.target.value}`;
                  } else {
                    newData[editingChartItem.idx] = e.target.value;
                  }
                  updateCurrentCard({ visualData: newData });
                }}
              />
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                onClick={() => setEditingChartItem(null)}
                style={{ ...aiSmallBtn, flex: 1, backgroundColor: '#334155' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 강조 메뉴 */}
      {floatingMenu.visible && (
        <div style={{
          position: 'fixed',
          left: floatingMenu.x,
          top: floatingMenu.y,
          transform: 'translateX(-50%)',
          backgroundColor: '#2d333f',
          padding: '8px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          display: 'flex',
          gap: '8px',
          zIndex: 2000,
          border: '1px solid #3f4654',
          alignItems: 'center'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginRight: '4px', fontWeight: '600' }}>강조:</div>
          <button 
            onClick={() => handleHighlightSelection(floatingMenu.field!)}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              background: floatingMenu.field === 'title' 
                ? 'linear-gradient(to bottom, #06BFF7, #001AFF)' 
                : '#005EFF',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              transition: 'transform 0.1s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title="강조 적용/해제"
          />
          <button 
            onClick={handleClearHighlight}
            style={{
              padding: '0 10px',
              height: '24px',
              borderRadius: '12px',
              border: '1px solid #3f4654',
              cursor: 'pointer',
              background: '#1e2530',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 'bold',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
              transition: 'transform 0.1s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            title="강조 초기화 (현재 페이지 전체)"
          >
            초기화
          </button>
          <div style={{ width: '1px', height: '16px', backgroundColor: '#3f4654', margin: '0 4px' }} />
          <button 
            onClick={() => setFloatingMenu({ ...floatingMenu, visible: false })}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <div ref={allCardsRef} style={{ width: '1080px' }}>
          {generatedCards.map((card, idx) => {
            const isFirst = idx === 0;
            const isLast = generatedCards.length > 1 && idx === generatedCards.length - 1;
            const isMiddle = !isFirst && !isLast;
            
            return (
              <div key={idx} style={{
                ...cardCanvas,
                padding: 0,
                transform: 'none', // 캡처 시에는 스케일링 제거
                background: theme === 'light' 
                  ? "linear-gradient(to bottom, #ffffff 0%, #e8f2ff 100%)" 
                  : theme === 'dark' 
                    ? "#111827" 
                    : "linear-gradient(135deg, #005EFF 0%, #00B2FF 100%)",
                color: theme === 'light' ? "#111" : "#fff",
                marginBottom: '100px' // 요소 간 간격
              }}>
                {isLast ? (
                  // --- [마지막 장: Frame-1 CTA 레이아웃] ---
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start',
                    padding: '80px 80px', boxSizing: 'border-box'
                  }}>
                    {/* 로고 상단 고정 */}
                    <div style={logoWrapper}>
                      <NHNCloudLogo color={theme === 'light' ? "#191919" : "white"} />
                    </div>

                    <div style={{ 
                      ...cardTitleStyle,
                      fontSize: '62px',
                      color: theme === 'light' ? '#333' : '#fff',
                      marginBottom: '32px'
                    }}>
                      {renderEmphasizedText(card.title, 'title')}
                    </div>
                    <div style={{
                      fontSize: '34px',
                      fontWeight: '600',
                      color: theme === 'light' ? '#666' : '#ccc',
                      fontFamily: 'Pretendard, sans-serif',
                      letterSpacing: '-1px'
                    }}>
                      ( 🔗 포스팅 본문 링크 참조 )
                    </div>
                  </div>
                ) : isMiddle ? (
                  // --- [중간 장: Frame-2 데이터 시각화 레이아웃] ---
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start',
                    padding: '80px 80px', boxSizing: 'border-box'
                  }}>
                    {/* 로고 */}
                    <div style={logoWrapper}>
                      <NHNCloudLogo color={theme === 'light' ? "#191919" : "white"} />
                    </div>

                    <div style={{ 
                      ...cardTitleStyle,
                      fontSize: '67px',
                      marginTop: '110px',
                      color: theme === 'light' ? '#333' : '#fff',
                    }}>
                      {renderEmphasizedText(card.title, 'title')}
                    </div>
                    <div style={{ 
                      ...cardContentStyle,
                      color: theme === 'light' ? '#333' : '#fff',
                    }}>
                      {card.content.split('\n').map((line, i) => (
                        <div key={i}>
                          {renderEmphasizedText(line, 'content')}
                        </div>
                      ))}
                    </div>
                    
                    {/* 우하단 요소 (이미지 또는 도표) */}
                    <div style={{ 
                      position: 'absolute', 
                      right: '40px', 
                      bottom: '40px', 
                      width: '450px', 
                      height: '400px', 
                      display: 'flex', 
                      alignItems: 'flex-end', 
                      justifyContent: 'flex-end',
                      zIndex: 5
                    }}>
                      {(card.visualType === 'icon' || card.visualType === 'photo') && (card.uploadedImg || card.aiGeneratedImg) ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                          {card.uploadedImg ? (
                            <img src={card.uploadedImg} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${card.imgScale || 1.0})`, transformOrigin: 'bottom right' }} alt="Custom" referrerPolicy="no-referrer" />
                          ) : (
                            <img src={card.aiGeneratedImg!} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${card.imgScale || 1.0})`, transformOrigin: 'bottom right', filter: theme === 'blue' ? 'brightness(1.5)' : 'none' }} alt="AI" referrerPolicy="no-referrer" />
                          )}
                        </div>
                      ) : (
                        <div style={{ 
                          width: '100%', 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          padding: '20px',
                          transform: `scale(${card.imgScale || 1.0})`,
                          transformOrigin: 'bottom right'
                        }}>
                          {/* 도표/다이어그램 렌더링 (PDF용은 정적 렌더링) */}
                          {card.visualType === 'chart' && card.visualData && (
                            <div style={{ width: '100%', height: '100%' }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={card.visualData.map((item: any) => {
                                  if (typeof item === 'string' && item.includes(':')) {
                                    const [name, value] = item.split(':');
                                    return { name, value: parseFloat(value) || 0 };
                                  }
                                  return { name: String(item), value: 0 };
                                })}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'light' ? '#e2e8f0' : '#334155'} />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'light' ? '#64748b' : '#94a3b8', fontSize: 12 }} />
                                  <YAxis hide />
                                  <Bar dataKey="value" fill="#005EFF" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                          {card.visualType === 'diagram' && card.visualData && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                              {card.visualData.map((step: string, i: number) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                  <div style={{ 
                                    width: '40px', height: '40px', borderRadius: '50%', 
                                    backgroundColor: '#005EFF', color: 'white', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: '800', fontSize: '18px'
                                  }}>
                                    {i + 1}
                                  </div>
                                  <div style={{ 
                                    flex: 1, padding: '12px 20px', borderRadius: '12px',
                                    backgroundColor: theme === 'light' ? 'rgba(0,94,255,0.05)' : 'rgba(255,255,255,0.1)',
                                    color: theme === 'light' ? '#1e293b' : '#fff',
                                    fontSize: '18px', fontWeight: '600'
                                  }}>
                                    {step}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // --- [첫 장: Frame-0 메인 타이틀 레이아웃] ---
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start',
                    padding: '80px 80px', boxSizing: 'border-box'
                  }}>
                    {/* 로고 */}
                    <div style={logoWrapper}>
                      <NHNCloudLogo color={theme === 'light' ? "#191919" : "white"} />
                    </div>

                    {/* 제목 영역 */}
                    <div style={{ 
                      ...cardTitleStyle,
                      fontSize: idx === 0 ? '86px' : (idx === generatedCards.length - 1 ? '62px' : '67px'),
                      marginTop: idx === 0 ? '110px' : (idx === generatedCards.length - 1 ? '0' : '110px'),
                      background: idx === 0 ? "linear-gradient(to bottom, #06BFF7 0%, #001AFF 100%)" : "none",
                      WebkitBackgroundClip: idx === 0 ? "text" : "none",
                      WebkitTextFillColor: idx === 0 ? "transparent" : (theme === 'light' ? '#333' : '#fff'),
                      color: idx === 0 ? "transparent" : (theme === 'light' ? '#333' : '#fff'),
                      letterSpacing: idx === 0 ? '-3px' : '-0.05em'
                    }}>
                      {idx === 0 ? card.title : renderEmphasizedText(card.title, 'title')}
                    </div>
                    <div style={{ 
                      ...cardContentStyle,
                      color: theme === 'light' ? '#333' : '#fff',
                    }}>
                      {renderEmphasizedText(card.content, 'content')}
                    </div>
                    
                    {/* 장식 요소 추가 (첫 장) */}
                    <div style={decoArea}>
                      {selectedImageStyle === "글래스모피즘" && (
                        <>
                          <div style={{ ...decoBlueCircle, backgroundColor: theme === 'blue' ? 'rgba(255,255,255,0.2)' : '#2563eb' }}></div>
                          <div style={decoCyanDot}></div>
                          <div style={decoGradCircle}></div>
                        </>
                      )}
                      <div style={aiImageWrapper}>
                        {card.uploadedImg ? (
                          <img src={card.uploadedImg} style={{ ...customImgElement, transform: `scale(${card.imgScale || 1.0}) translate(${card.imgOffsetX || 0}px, ${card.imgOffsetY || 0}px)` }} alt="Custom" referrerPolicy="no-referrer" />
                        ) : card.aiGeneratedImg ? (
                          <img src={card.aiGeneratedImg} style={{ ...aiImgElement, transform: `scale(${card.imgScale || 1.0}) translate(${card.imgOffsetX || 0}px, ${card.imgOffsetY || 0}px)`, filter: theme === 'blue' ? 'brightness(1.5)' : 'none' }} alt="AI" referrerPolicy="no-referrer" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
// --- 최종 스타일링 ---
const cardTitleStyle: React.CSSProperties = { 
  fontFamily: "'NHN Sans', 'NHNSans', 'NHN Sans KR', 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", 
  fontSize: "84px", 
  fontWeight: "700", 
  lineHeight: "1.1", 
  letterSpacing: "-0.05em", 
  color: "#005EFF",
  marginBottom: "40px",
  whiteSpace: "pre-wrap",
  overflow: "visible",
  maxWidth: "1000px",
  display: "block",
  height: "auto",
  wordBreak: "keep-all"
};

const cardContentStyle: React.CSSProperties = { 
  fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif", 
  fontSize: "34px", 
  lineHeight: "1.4", 
  color: "#333", 
  fontWeight: "500", 
  letterSpacing: "-0.02em",
  whiteSpace: "pre-wrap",
  maxWidth: "900px", 
  overflow: "visible",
  display: "block",
  height: "auto",
  wordBreak: "keep-all"
};
const logoWrapper: React.CSSProperties = { 
  position: 'absolute',
  top: '48px',
  left: '55px',
  display: "flex", 
  alignItems: "center", 
  zIndex: 10 
};
const logoImgStyle: React.CSSProperties = { height: "44px", width: "auto" };

const wrapStyle: React.CSSProperties = { backgroundColor: "#111827", minHeight: "100vh", color: "white", display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 0" };
const headerSection: React.CSSProperties = { textAlign: "center", marginBottom: "50px" };
const headerMainTitle: React.CSSProperties = { fontSize: "32px", fontWeight: "800", marginBottom: "12px" };
const headerSubTitle: React.CSSProperties = { color: "#94a3b8", fontSize: "16px" };
const mainLayout: React.CSSProperties = { display: "grid", gridTemplateColumns: "400px 1fr", gap: "60px", maxWidth: "1250px", width: "95%", alignItems: "flex-start" };
const leftPanel: React.CSSProperties = { backgroundColor: "#1e2530", borderRadius: "20px", padding: "40px", border: "1px solid #2d333f", boxSizing: "border-box" };
const inputItem: React.CSSProperties = { marginBottom: "28px" };
const labelStyle: React.CSSProperties = { display: "block", color: "#94a3b8", fontSize: "13px", fontWeight: "600", marginBottom: "12px" };
const textareaStyle: React.CSSProperties = { width: "100%", backgroundColor: "#242a38", border: "1px solid #3f4654", color: "white", padding: "18px", borderRadius: "10px", outline: "none", fontSize: "15px", height: "100px", resize: "none", lineHeight: "1.5", boxSizing: "border-box" };
const refineBtnGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' };
const refineBtn: React.CSSProperties = { backgroundColor: '#313948', color: '#cbd5e1', border: '1px solid #3f4654', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' };
const downloadButtonStyle: React.CSSProperties = { width: "100%", backgroundColor: "#2563eb", color: "white", border: "none", padding: "20px", borderRadius: "12px", fontSize: "17px", fontWeight: "700", cursor: "pointer", marginTop: "20px" };
const aiSmallBtn: React.CSSProperties = { background: "#4f46e5", color: "white", border: "none", padding: "5px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", cursor: "pointer", whiteSpace: 'nowrap' };
const uploadButtonStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', background: '#313948', color: 'white', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' };
const imageInputStyle: React.CSSProperties = { flex: 1, backgroundColor: '#242a38', border: '1px solid #3f4654', color: 'white', padding: '12px', borderRadius: '10px', outline: 'none' };
const posBtnStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  backgroundColor: '#242a38',
  border: '1px solid #3f4654',
  borderRadius: '6px',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: '12px'
};
const imageGenBtn: React.CSSProperties = { backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '0 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' };
const regenerateBtn: React.CSSProperties = { background: 'none', border: '1px solid #3f4654', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: '600' };
const scaleControlBox: React.CSSProperties = { background: '#242a38', padding: '15px', borderRadius: '10px', border: '1px solid #3f4654', marginTop: '10px' };
const previewTitle: React.CSSProperties = { fontSize: "20px", fontWeight: "700", marginBottom: "35px" };
const previewContainer: React.CSSProperties = { flex: 1, display: "flex", justifyContent: "flex-start", alignItems: "flex-start" };
const rightArea: React.CSSProperties = { display: "flex", flexDirection: "column" };
const cardCanvas: React.CSSProperties = { 
  width: "1080px", 
  height: "1080px", 
  background: "linear-gradient(to bottom, #ffffff 0%, #e8f2ff 100%)", 
  color: "#111", 
  padding: 0, 
  position: "relative", 
  boxSizing: "border-box", 
  boxShadow: "0 20px 80px rgba(0,0,0,0.3)", 
  overflow: 'hidden' 
};
const decoArea: React.CSSProperties = { position: 'absolute', right: '0', bottom: '0', width: '600px', height: '600px' };
const decoBlueCircle: React.CSSProperties = { position: "absolute", right: "64px", bottom: "144px", width: "220px", height: "220px", backgroundColor: "#2563eb", borderRadius: "50%", zIndex: 1 };
const decoCyanDot: React.CSSProperties = { position: "absolute", right: "424px", bottom: "124px", width: "22px", height: "22px", backgroundColor: "#00f2ff", borderRadius: "50%", zIndex: 1 };
const decoGradCircle: React.CSSProperties = { position: "absolute", right: "364px", bottom: "84px", width: "55px", height: "55px", background: "linear-gradient(135deg, #00f2ff, #005eff)", borderRadius: "50%", zIndex: 1 };
const aiImageWrapper: React.CSSProperties = { 
  position: 'absolute', 
  right: '40px', 
  bottom: '30px', 
  width: '520px', 
  height: '520px', 
  zIndex: 2, 
  display: 'flex', 
  alignItems: 'flex-end', 
  justifyContent: 'flex-end',
  pointerEvents: 'none'
};
const aiImgElement: React.CSSProperties = { 
  maxWidth: '100%', 
  maxHeight: '100%', 
  objectFit: 'contain', 
  transition: 'transform 0.1s linear',
  transformOrigin: 'bottom right'
};
const customImgElement: React.CSSProperties = { 
  maxWidth: '100%', 
  maxHeight: '100%', 
  objectFit: 'contain', 
  transition: 'transform 0.1s linear',
  transformOrigin: 'bottom right'
};
const modalOverlay: React.CSSProperties = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };
const modalContent: React.CSSProperties = { backgroundColor: '#1e2530', width: '500px', padding: '30px', borderRadius: '20px', border: '1px solid #3f4654' };
const modalTextarea: React.CSSProperties = { width: '100%', height: '180px', backgroundColor: '#242a38', border: '1px solid #3f4654', color: 'white', padding: '15px', borderRadius: '10px', marginBottom: '20px', resize: 'none', boxSizing: 'border-box' };
const modalInput: React.CSSProperties = { width: '100%', backgroundColor: '#242a38', border: '1px solid #3f4654', color: 'white', padding: '15px', borderRadius: '10px', marginBottom: '20px', outline: 'none', boxSizing: 'border-box' };
const tabBtn: React.CSSProperties = { flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600' };
const analyzeBtn: React.CSSProperties = { 
  flex: 1, 
  padding: '15px', 
  borderRadius: '10px', 
  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', 
  color: 'white', 
  fontWeight: 'bold', 
  border: 'none', 
  cursor: 'pointer',
  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
};
