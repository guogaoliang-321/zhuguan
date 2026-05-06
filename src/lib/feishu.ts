/**
 * 飞书机器人 webhook 推送（可选，环境变量 FEISHU_WEBHOOK_URL 不存在时静默跳过）
 *
 * 文档：https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot
 *
 * 复用方式：
 *   await sendFeishuMessage({ title, content })
 */

const URL_FROM_ENV = (): string | null => {
  const url = process.env.FEISHU_WEBHOOK_URL;
  if (!url || !url.startsWith("https://")) return null;
  return url;
};

export interface FeishuMessage {
  title: string;
  content: string;
  /** 可选，"red" | "orange" | "green" | "blue" | "grey" — 飞书卡片颜色 */
  color?: "red" | "orange" | "green" | "blue" | "grey";
  /** 可选，跳转链接 */
  link?: string;
}

/** 发送一条富文本卡片消息；返回 true 表示成功投递 */
export async function sendFeishuMessage(msg: FeishuMessage): Promise<boolean> {
  const url = URL_FROM_ENV();
  if (!url) return false;

  const card = {
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: msg.title },
        template: msg.color ?? "blue",
      },
      elements: [
        {
          tag: "div",
          text: { tag: "lark_md", content: msg.content },
        },
        ...(msg.link
          ? [
              {
                tag: "action",
                actions: [
                  {
                    tag: "button",
                    text: { tag: "plain_text", content: "查看详情" },
                    url: msg.link,
                    type: "primary",
                  },
                ],
              },
            ]
          : []),
      ],
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
      // 飞书 webhook 通常 < 2s，超时 10s 兜底
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
