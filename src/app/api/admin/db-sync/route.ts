import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const USERS = [
  {"id":"cmnyq2oq400000sbps9xspzjg","username":"guogaoliang","password":"$2b$10$xvoLQAxr2k6DnAJUVEv4b.NswViqVHpYxu9VCn8p5Hf.Mn/E3QsQG","name":"郭高亮","role":"ADMIN","phone":"18629148762","department":"医疗健康设计部","position":"副总建筑师、部长","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":null,"specialty":null,"createdAt":"2026-04-14T14:34:09.196Z","updatedAt":"2026-04-14T14:34:09.196Z"},
  {"id":"cmohggno60000habptvvly1sh","username":"wangyanjun","password":"$2b$10$/fBaoVE0tDRcWZ./PtDngOFTc16y9eHHcrBsnNv0elqx6ROm4X14m","name":"王艳俊","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST4-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"142726198112052739","specialty":"建筑","createdAt":"2026-04-27T17:12:42.198Z","updatedAt":"2026-04-27T17:12:42.198Z"},
  {"id":"cmohggnra0001habpfwa977mt","username":"duanchenggang","password":"$2b$10$LG4fF3ny9H0BIom7FU/uF.CYbJUlyCWvlmU3wq6.QlpPQJATgs.IK","name":"段成刚","role":"PROJECT_LEAD","phone":null,"department":null,"position":"结构正高 ST4-4","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610103196906112814","specialty":"结构","createdAt":"2026-04-27T17:12:42.310Z","updatedAt":"2026-04-27T17:12:42.310Z"},
  {"id":"cmohggnu90002habp7kzx9moj","username":"jiangzhong","password":"$2b$10$Q95rdd54vMjXk7rxcfP/x.zcNM6svZ04AXsDR0cSFbjpzat0vdMHW","name":"蒋忠","role":"PROJECT_LEAD","phone":null,"department":null,"position":"暖通正高 ST4-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610104196811150611","specialty":"暖通","createdAt":"2026-04-27T17:12:42.417Z","updatedAt":"2026-04-27T17:12:42.417Z"},
  {"id":"cmohggnx70003habpke5cifca","username":"zhaobo","password":"$2b$10$wwQWzqfVS9ZTX/SlX90JQOt5m03.3jTn/5PGF8Xt6v.rTopm6RqVC","name":"赵博","role":"PROJECT_LEAD","phone":null,"department":null,"position":"给排水正高 ST3-4","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610125197910190332","specialty":"给排水","createdAt":"2026-04-27T17:12:42.523Z","updatedAt":"2026-04-27T17:12:42.523Z"},
  {"id":"cmohggo050004habp0otv7ise","username":"heyanan","password":"$2b$10$ULaz9ZsDaYLQLtMxqf3omuEcLDzHqGeeu2o8PgjUspzzNWr/u1Mi2","name":"何亚男","role":"PROJECT_LEAD","phone":null,"department":null,"position":"暖通高级 ST3-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"52212419870315322X","specialty":"暖通","createdAt":"2026-04-27T17:12:42.629Z","updatedAt":"2026-04-27T17:12:42.629Z"},
  {"id":"cmohggo350005habp13s2n27g","username":"dingjie","password":"$2b$10$I.MmM1QJu5bX.mtDWvE2G.tyALbxUK221RargZgBBtJpVl/1C31ry","name":"丁洁","role":"MEMBER","phone":null,"department":null,"position":"建筑高级 ST3-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"612730198401180021","specialty":"建筑","createdAt":"2026-04-27T17:12:42.737Z","updatedAt":"2026-04-27T17:12:42.737Z"},
  {"id":"cmohggo6x0006habpz7t5fwlw","username":"yangyi","password":"$2b$10$lwfWQyKkI8USZEt0/CGC3.ndsFZc1BQAY2/8mNI1RTSdUEIJ2oeMW","name":"杨毅","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST3-4","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"61011219880226101X","specialty":"建筑","createdAt":"2026-04-27T17:12:42.873Z","updatedAt":"2026-04-27T17:12:42.873Z"},
  {"id":"cmohggoe90008habpu96zeer2","username":"liujingshan","password":"$2b$10$NPBYrTBH2XhYOjlLJv5B6eaHadY5Mj4kpNKqaKUz09kckL0s/VNGO","name":"刘静珊","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST3-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"13070319870707092X","specialty":"建筑","createdAt":"2026-04-27T17:12:43.137Z","updatedAt":"2026-04-27T17:12:43.137Z"},
  {"id":"cmohggohm0009habps51h1v89","username":"leijian","password":"$2b$10$48DeD.GDZR6UN7PGlG7Qk.NzkirDgXS7qg4eJ/iujysTgkuMzutLe","name":"雷健","role":"PROJECT_LEAD","phone":null,"department":null,"position":"结构正高 ST4-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610103198101133617","specialty":"结构","createdAt":"2026-04-27T17:12:43.258Z","updatedAt":"2026-04-27T17:12:43.258Z"},
  {"id":"cmohggolg000ahabpfbjacgpn","username":"caoqiang","password":"$2b$10$fHhQkfK5jxoDQyyhp77ZlObrF4/O6q6pEoJhiZBe6rhYvijKPERrK","name":"曹强","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST3-4","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610104197203190614","specialty":"建筑","createdAt":"2026-04-27T17:12:43.396Z","updatedAt":"2026-04-27T17:12:43.396Z"},
  {"id":"cmohggoov000bhabpnkl0a5wr","username":"zhaoshiyi","password":"$2b$10$zD2k.Xz4j.ID8ni3IjXp7ubHkp45lALwI6rf1Loz2b64dWTStZyRS","name":"赵世轶","role":"MEMBER","phone":null,"department":null,"position":"结构高级 ST3-4","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"410181197707155076","specialty":"结构","createdAt":"2026-04-27T17:12:43.519Z","updatedAt":"2026-04-27T17:12:43.519Z"},
  {"id":"cmohggorz000chabp2tzwuern","username":"liyanzhi","password":"$2b$10$i72.NZlgh8ZZXCgh85EM9OlS6vI.YSQQ1vm3Vlx9.HB2cGE0PZGyW","name":"李艳芝","role":"MEMBER","phone":null,"department":null,"position":"电气正高 ST3-4","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"140423197501084441","specialty":"电气","createdAt":"2026-04-27T17:12:43.631Z","updatedAt":"2026-04-27T17:12:43.631Z"},
  {"id":"cmohggovk000dhabpzmqwi4qe","username":"yanglei","password":"$2b$10$HTUXJrRA7TCAB4QDTqHsT.YH1SWJUwOfLvbvGz7h2oJi70SkyNCD6","name":"杨磊","role":"MEMBER","phone":null,"department":null,"position":"结构高级 ST3-4","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"61010419781228005X","specialty":"结构","createdAt":"2026-04-27T17:12:43.760Z","updatedAt":"2026-04-27T17:12:43.760Z"},
  {"id":"cmohggozd000ehabpluk28naj","username":"huangle","password":"$2b$10$rweUSSU5omTBgD33BrSVEeZPwfDc70kZqhIrxqV8d1Vs5w89zdszu","name":"黄乐","role":"PROJECT_LEAD","phone":null,"department":null,"position":"电气高级 ST3-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610424198203036613","specialty":"电气","createdAt":"2026-04-27T17:12:43.897Z","updatedAt":"2026-04-27T17:12:43.897Z"},
  {"id":"cmohggp2u000fhabp953g3s2p","username":"lilei","password":"$2b$10$odFIUm8zK4/s3SuY9hRASOKIE.SOGPqykpAoCr74Upn2jEUXsgtMS","name":"李蕾","role":"MEMBER","phone":null,"department":null,"position":"建筑高级 ST3-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610528198607067863","specialty":"建筑","createdAt":"2026-04-27T17:12:44.022Z","updatedAt":"2026-04-27T17:12:44.022Z"},
  {"id":"cmohggp5x000ghabpfo98ztfb","username":"xingjunzhe","password":"$2b$10$jSeEddWg8nwigJKrKxOReuUq.ucDcW0M/4FMtz6pRvV3nfYsXLovG","name":"邢俊哲","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST2-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610112199001242526","specialty":"建筑","createdAt":"2026-04-27T17:12:44.133Z","updatedAt":"2026-04-27T17:12:44.133Z"},
  {"id":"cmohggp8x000hhabpq0pe3wiq","username":"zhangmingliang","password":"$2b$10$nKR7m1O7nX4aOkmkS2jNIOnkltbT46b5JC2vfV.0dqOLEthX4rBim","name":"张名良","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST3-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610103198709222431","specialty":"建筑","createdAt":"2026-04-27T17:12:44.241Z","updatedAt":"2026-04-27T17:12:44.241Z"},
  {"id":"cmohggpby000ihabphtmbf90e","username":"wangyikai","password":"$2b$10$UFjEXnE1f18FpNggjie4IOLtXqtH/F7JPY0HL7tsuhv4weSST3kXO","name":"王绎凯","role":"MEMBER","phone":null,"department":null,"position":"结构高级 ST2-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"142702199302260030","specialty":"结构","createdAt":"2026-04-27T17:12:44.350Z","updatedAt":"2026-04-27T17:12:44.350Z"},
  {"id":"cmohggpf5000jhabpphr0ohjb","username":"dengqianze","password":"$2b$10$ALw.6fGpATAX29zMD3oODOpaHks51rTYwLBgOQdxiufn/1bp/H74m","name":"邓茜泽","role":"MEMBER","phone":null,"department":null,"position":"建筑初级 ST1-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610111199406085040","specialty":"建筑","createdAt":"2026-04-27T17:12:44.465Z","updatedAt":"2026-04-27T17:12:44.465Z"},
  {"id":"cmohggpi4000khabpjwbejjoa","username":"qianwei","password":"$2b$10$K9s4G1c0crPjluqg/0NwTO.nDX1jrk.FtDpmlvbKyf.5PedP1fZ.W","name":"钱薇","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST3-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"61010319860719162X","specialty":"建筑","createdAt":"2026-04-27T17:12:44.572Z","updatedAt":"2026-04-27T17:12:44.572Z"},
  {"id":"cmohggpl3000lhabpv8vnvl6w","username":"fengye","password":"$2b$10$bUwT6bohgRaFmcEnlKYRY..iqmNkd08l3HRcAfGCsk9xfyiclLQ.O","name":"冯晔","role":"MEMBER","phone":null,"department":null,"position":"暖通初级 ST2-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610303199806092443","specialty":"暖通","createdAt":"2026-04-27T17:12:44.679Z","updatedAt":"2026-04-27T17:12:44.679Z"},
  {"id":"cmohggpo2000mhabp6qebn58y","username":"zhangshitao","password":"$2b$10$dDpb2TCz3imXeTAL41wdQeQ0QaONFK7iUoXE.6Qsxc6yQADy2jTNy","name":"张世涛","role":"MEMBER","phone":null,"department":null,"position":"暖通中级 ST2-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"612526198708192937","specialty":"暖通","createdAt":"2026-04-27T17:12:44.786Z","updatedAt":"2026-04-27T17:12:44.786Z"},
  {"id":"cmohggpr0000nhabp909gtl5a","username":"zhangyaoyuan","password":"$2b$10$7H07Dui4oxSH3Y4KjZ.uiuaaCqaEUFk/MjBeqnl6QzOb7dLL72biq","name":"张耀元","role":"MEMBER","phone":null,"department":null,"position":"结构高级 ST3-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"622701198804204526","specialty":"结构","createdAt":"2026-04-27T17:12:44.892Z","updatedAt":"2026-04-27T17:12:44.892Z"},
  {"id":"cmohggptz000ohabpno1krlsl","username":"zhanghui","password":"$2b$10$EVi6IJf0x9SFrM.a5WOJ5.ijm6jI9Z3pLrOd1huJuXVxOsTd8WAQ6","name":"张辉","role":"MEMBER","phone":null,"department":null,"position":"结构高级 ST3-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"370403198802011117","specialty":"结构","createdAt":"2026-04-27T17:12:44.999Z","updatedAt":"2026-04-27T17:12:44.999Z"},
  {"id":"cmohggpwy000phabpzgpl7xfx","username":"wujingtao","password":"$2b$10$SEHr6hHquVoe4dbe6mriauPYyRNutFA27.zTrVnz15xAiCxdbXwTy","name":"吴京涛","role":"MEMBER","phone":null,"department":null,"position":"给排水高级 ST3-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610102198907161514","specialty":"给排水","createdAt":"2026-04-27T17:12:45.106Z","updatedAt":"2026-04-27T17:12:45.106Z"},
  {"id":"cmohggpzx000qhabp4oxd5z71","username":"yangyang","password":"$2b$10$bOPgfN/qF4KeqPyyc9iiyubmxdW9aulYvWSVP0/EQj6B4isWVHRfW","name":"杨阳","role":"MEMBER","phone":null,"department":null,"position":"建筑高级 ST2-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610423199303220926","specialty":"建筑","createdAt":"2026-04-27T17:12:45.213Z","updatedAt":"2026-04-27T17:12:45.213Z"},
  {"id":"cmohggq2v000rhabpt33llyas","username":"huzhehui","password":"$2b$10$KBmxzc3m4.hP0OoUHykFBO5TQbrXXN.v6ZyVfj6cZeRlsdLStzkIS","name":"胡哲辉","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST2-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610104199103166114","specialty":"建筑","createdAt":"2026-04-27T17:12:45.319Z","updatedAt":"2026-04-27T17:12:45.319Z"},
  {"id":"cmohggq5t000shabpu5u59kpz","username":"wangwei","password":"$2b$10$AwvEkFYoFOxO0ldNb8Btoe6AQfrtXUKjwoiWOoJ1jtzCKYadXgrhC","name":"王伟","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST2-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"612401199306269112","specialty":"建筑","createdAt":"2026-04-27T17:12:45.425Z","updatedAt":"2026-04-27T17:12:45.425Z"},
  {"id":"cmohggq8s000thabprf6hj1h7","username":"zhangchunsheng","password":"$2b$10$IyBpfQc/jCHYWZ.qc3ZVyuVYxQC1l9H0AJT892bf3oh6CaseY6Ype","name":"张春生","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST2-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"411024199001032557","specialty":"建筑","createdAt":"2026-04-27T17:12:45.532Z","updatedAt":"2026-04-27T17:12:45.532Z"},
  {"id":"cmohggqbr000uhabp4tlxv8e5","username":"duanzeming","password":"$2b$10$RAZzq7JXFqZHILIbY4tLIOr9U8uNKYJlGJl5tKkmMdiSCdZe9Ynze","name":"段则明","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST2-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610203199208112218","specialty":"建筑","createdAt":"2026-04-27T17:12:45.639Z","updatedAt":"2026-04-27T17:12:45.639Z"},
  {"id":"cmohggqes000vhabpt1ayglgc","username":"zhaoxi","password":"$2b$10$8aVZZHKAByh2.NZNsx0xYOWOkSvQRK0UTpMfZ5DQd5y5rNPUzUzye","name":"赵玺","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST2-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"61011319891013046X","specialty":"建筑","createdAt":"2026-04-27T17:12:45.748Z","updatedAt":"2026-04-27T17:12:45.748Z"},
  {"id":"cmohggqhq000whabpyi2omr32","username":"liyawei","password":"$2b$10$N4P6We7KBEHDes0SMLg1kOD5imzpW0js/EhZmB4xPUGc4kQMZxwq.","name":"李亚伟","role":"PROJECT_LEAD","phone":null,"department":null,"position":"建筑高级 ST3-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"612725198508014217","specialty":"建筑","createdAt":"2026-04-27T17:12:45.854Z","updatedAt":"2026-04-27T17:12:45.854Z"},
  {"id":"cmohggqkq000xhabpr4inosk3","username":"wangrong","password":"$2b$10$ZKSIcRmX/pXG8nyVzJt/3evPM.CUd4YMVbyEfF.Omx3HWYyUBVoqG","name":"王蓉","role":"MEMBER","phone":null,"department":null,"position":"电气中级 ST1-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610124199707050927","specialty":"电气","createdAt":"2026-04-27T17:12:45.962Z","updatedAt":"2026-04-27T17:12:45.962Z"},
  {"id":"cmohggqno000yhabpdzypbb4k","username":"jiangzhilin","password":"$2b$10$rLhv.yYLttltQlFG0InEPuu4v/a37ZurO/bfJmzhfcKwA3.dQf2Jm","name":"姜志琳","role":"MEMBER","phone":null,"department":null,"position":"结构中级 ST2-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"142726199303221827","specialty":"结构","createdAt":"2026-04-27T17:12:46.068Z","updatedAt":"2026-04-27T17:12:46.068Z"},
  {"id":"cmohggqqn000zhabpaa864wez","username":"wutong","password":"$2b$10$LXouZPYPKOLU0xhhgpjGs.BwJHI510DSf4qERmPFE.BOdBo9eSMpi","name":"武桐","role":"MEMBER","phone":null,"department":null,"position":"建筑初级 ST1-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"612323199501016025","specialty":"建筑","createdAt":"2026-04-27T17:12:46.175Z","updatedAt":"2026-04-27T17:12:46.175Z"},
  {"id":"cmohggqtl0010habpm82prgti","username":"yinglanxuan","password":"$2b$10$t/qXOFnS.38evUpBQeH4c.zDX0ddOKl1pu3Vd9IYRCoJ.43m6A.sq","name":"应蓝萱","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST1-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"610104199710100627","specialty":"建筑","createdAt":"2026-04-27T17:12:46.281Z","updatedAt":"2026-04-27T17:12:46.281Z"},
  {"id":"cmohggqwk0011habp4k4evhrn","username":"zhaoning","password":"$2b$10$hRu0wxO1M81b2G0GoOzYLOXvB7xcs0i4KzilnTKW73iCx94hTrlPK","name":"赵宁","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST1-3","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"130602199606200310","specialty":"建筑","createdAt":"2026-04-27T17:12:46.388Z","updatedAt":"2026-04-27T17:12:46.388Z"},
  {"id":"cmohggqzj0012habpvelm8htz","username":"zhangwanjun","password":"$2b$10$RBiPBm4/eP8wnPQBxalEHu6JXhvKKEYl.0VR8pSWif2zBHwyQ4bnS","name":"张婉军","role":"MEMBER","phone":null,"department":null,"position":"建筑中级 ST2-1","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"61052319890813006X","specialty":"建筑","createdAt":"2026-04-27T17:12:46.495Z","updatedAt":"2026-04-27T17:12:46.495Z"},
  {"id":"cmohggr2j0013habpxiyu6mo7","username":"chensu","password":"$2b$10$fblNBSuSME.UhzvtYO8eT.YoYWIx8YpSrZ0WqyU.3VhT.Wiyu7ef6","name":"陈素","role":"MEMBER","phone":null,"department":null,"position":"助理工程师 ST1-2","avatar":null,"weeklyCapacity":"40","isActive":true,"idNumber":"622429199704170045","specialty":"建筑","createdAt":"2026-04-27T17:12:46.603Z","updatedAt":"2026-04-27T17:12:46.603Z"},
] as const;

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await prisma.workLog.deleteMany();
    await prisma.projectNote.deleteMany();
    await prisma.projectMember.deleteMany();
    await prisma.milestone.deleteMany();
    await prisma.project.deleteMany();
    await prisma.nonProjectCategory.deleteMany();
    await prisma.user.deleteMany();

    let inserted = 0;
    for (const u of USERS) {
      await prisma.user.create({
        data: {
          id: u.id,
          username: u.username,
          password: u.password,
          name: u.name,
          role: u.role as "ADMIN" | "PROJECT_LEAD" | "MEMBER",
          phone: u.phone,
          department: u.department,
          position: u.position,
          avatar: u.avatar,
          weeklyCapacity: parseFloat(u.weeklyCapacity),
          isActive: u.isActive,
          idNumber: u.idNumber,
          specialty: u.specialty,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        },
      });
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
