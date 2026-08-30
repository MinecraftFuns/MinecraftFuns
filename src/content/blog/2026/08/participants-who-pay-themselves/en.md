---
title: "Research participants who pay themselves"
description: "A country quiz got fifteen minutes of careful answers and a referral out of me, for nothing. What it would take to make a study recruit for itself the same way, and what that buys."
date: "2026-08-29"
tags: ["Notes", "Research Methods", "Social Computing"]
---

Someone sent me a screenshot from an online quiz: a few countries with a
percentage beside each, the ones the quiz said they most resembled. I asked
for [the link](https://www.culturacompass.com/) and did the quiz myself.

Fifteen minutes of questions, long for a social media pop quiz. It told me I
was twenty percent Canadian, fourteen percent Latvian and nine percent
Guatemalan, out of the ninety countries in the
[World Values Survey](https://worldvaluessurvey.org/wvs.jsp) data behind the
quiz. Under that, *Share with friends!*. I shared it in a group chat inside a
minute.

![Quiz result on a phone: Canada 20%, Latvia 14%, Guatemala 9%, above a line reading Share with friends!](https://ragnarok.joefang.org/static/xd9et2cacm8rfd7orfomb9t24og2ftm70.jpg)

Nobody paid me. It recruited me off somebody else's screenshot, held me
fifteen minutes, and got a referral out of me. Participants who pay
themselves, in a currency we never have to buy.

I messaged a collaborator with a version for our own study. We already ask
participants a handful of questions, so we could sort them into one of five
cute animals and end on a page polished enough to screenshot. People would
share it to show off their *uniqueness*.

Recruitment is the constraint on everything I would like to run. Screening,
scheduling, no-shows, a panel provider's minimum order, an ethics amendment
every time the protocol moves. A study needing two thousand people across a
dozen countries does not get run at all. It does not fit a lab budget, and few
labs are rich enough to make it fit. Build the same study so the result is
worth showing someone and the recruiting is free. Hosting is almost nothing,
the build is maybe a week of undergraduate work with a coding agent, and the
hard part is making it spread without wrecking the data.

## Does the packaging corrupt the answers?

The
[total survey error framework](https://academic.oup.com/poq/article/74/5/849/1817502)
splits the damage in two. Measurement error is when you asked badly or they
answered badly. Representation error is when the people who answered are not
the people you meant to describe.

[Germine and colleagues](https://lab.faceblind.org/papers/germine_12_pbr.pdf)
tested the first kind directly. They compared web participants who were
self-selected, uncompensated and unsupervised against traditionally
recruited lab samples, on mean performance, variance and internal
reliability. No systematic difference, including on timed perceptual tasks,
which are the hard case.

So the answers survive. What is left is *who turns up*.

## What it buys

A wider range of people than a lab gets. A lab sample is narrow by
construction: undergraduates on one campus in one language. Self-selected
web samples come out wider in age, education and geography.
[LabintheWild](https://dl.acm.org/doi/10.1145/2675133.2675246)'s stated
reason for paying in personalised feedback instead of money is exactly this:
money limits both the size and the variety of who turns up.

More of them, too. LabintheWild drew roughly
[3.5 million participants from more than 200 countries](https://www.eecs.harvard.edu/~kgajos/papers/2017/oliveira17labinthewild.pdf)
in four years.
[Moral Machine](https://www.nature.com/articles/s41586-018-0637-6) took 40
million decisions across 233 countries. The New York Times dialect quiz
pulled
[350,000 responses](https://knightlab.northwestern.edu/2014/01/20/behind-the-dialect-map-interactive-how-an-intern-created-the-new-york-times-most-popular-piece-of-content-in-2013/)
off the Harvard Dialect Survey inside two months.
[Von Ahn](https://dl.acm.org/doi/10.1145/1378704.1378719) had the shape of
it twenty years earlier in the games-with-a-purpose era: enjoyment as the
incentive, data as a byproduct. No grant I will ever hold buys a hundred
countries.

Experiments then come almost free. Self-selection wrecks any claim about how
common something is. It leaves a randomised comparison inside your own sample
completely alone. Moral
Machine ran a nine-factor design that would have been unaffordable country by
country, and LabintheWild's experiments replicate findings from the lab. If
the question is whether A beats B, a viral instrument is a very cheap way to
ask it.

The sharing decides who turns up, and nobody seems to have turned round and
studied it.

## What people are being paid

So I went looking for what makes a result worth passing on. My first attempt
sorted shareable things into genres, the way a marketer would: identity,
rarity, humour, awe. Too shallow. A genre is only the vehicle; what moves it
is the *reward* the sharer collects, and sorting by who collects that reward
explains much more.

[Huber, Reinecke and Gajos](https://kgajos.seas.harvard.edu/papers/huber17effect.pdf)
had already measured how much the result itself drives the sharing, across
81,131 participants of a feedback-driven platform. Higher performers shared
significantly more, the effect depended on whether people expected to do
well, and of three ways of presenting the same result, the one emphasising
relative success produced the most sharing. The result screen is the lever.
What belongs on it depends on which reward you are paying.

Some rewards are about you. They only work in front of people who already know
you, which is why messaging one close friend to say I came out Canadian and
Latvian would have been pointless. He knows.

Other rewards are about whoever you send it to. Insider jokes work this way,
and the fact that outsiders will not get it is what makes one worth sending.
Post one of those in public and it dies.

So I concluded, very tidily, that the first kind gets posted publicly and
the second kind gets sent privately, and that the shape of the sample was
predictable before writing any code.

## Then I looked at what I had done myself

I shared my three countries in a group chat.

That is a reward about me, collected in a channel I had filed under private.
The tidy version is wrong because I had run two separate things together:
*how many* people see a share, and *how close* you are to them.
[Barasch and Berger's broadcasting and narrowcasting](https://journals.sagepub.com/doi/10.1509/jmr.13.0238)
work is about the first; I had read it as though it were about the second.

A group chat sits in the corner I had left empty. Several people, all of whom
know me, none of them strangers. You can collect a reward about yourself there
without ever going public, and for a lot of people that is simply where things
get shared.

It is also the box I can see least. Traffic through a closed group reaches
people who already resemble each other. A study of half a million users
complicates that: direct messages carry
[more genuinely new information than public posts](https://arxiv.org/html/2408.03579)
despite going to closer friends, and the old story about weak ties spreading
furthest shows up only in public posting. Neither box is the bad one. They
fail differently.

So my two-box version dies and the claim underneath survives: the reward
decides where a share can go, and where it goes decides who ends up in the
study. Three boxes, and I suspect the middle one carries most of the
traffic. That leaves the design question: what reward can a given study
actually offer?

## Extract, transcode, plant

Take a study design already roughly in shape. Three things you can do to it.

You can extract: surface an output it already produces that is worth showing
someone. The dialect map is pure extraction, since the model output was the
shareable thing to begin with.

You can transcode: say the same thing in a form worth showing off. The five
animals are transcoding. The score is untouched and only the costume changes,
and this is the only one of the three that lets you decide how flattering the
answers feel without touching what you measure. Nobody posts a high
neuroticism score. Everybody posts a capybara, and the number underneath is
the same number.

Or you can plant: attach something fun that says nothing about the person at
all, generated from their answers but making no claim about them. That is what
is left when the study itself has nothing worth showing off in it, and it
means a reaction-time task is not shut out of any of this.

Dress up the display, never the data. The animal is just the highest of five
continuous numbers, so keep the five numbers; the moment the animal becomes
the thing you analyse, you have traded most of your measurement for a share
card.

[Berger and Heath](https://academic.oup.com/jcr/article/34/2/121/1793110)
put two limits on the transcoding move, both from the same paper. They found
people only bother to advertise being unusual in things they treat as part
of who they are: music and hairstyles qualify, backpacks do not. Values
clear that bar easily, which is why a country quiz works at all.

Their second point is that a signal stops being worth anything once everyone
has it, so sharing depends on how many people around you have already seen it.
With five animals, the sixth person in a group chat to announce they are a fox
gets nothing. A ranked handful drawn from ninety countries has an enormous
number of possible outcomes, so almost everyone's result is new to their
friends and the reward lasts much longer. Give people more possible answers if
you want it to keep moving; that matters more than which animals you pick.

## The half of the traffic you cannot see

Across eleven networks, a
[controlled attribution experiment](https://sparktoro.com/blog/new-research-dark-social-falsely-attributes-significant-percentages-of-web-traffic-as-direct/)
found every single visit from WhatsApp, TikTok, Slack, Discord and Mastodon
arriving tagged as direct with no referrer, along with three quarters of
Facebook Messenger and about a third of Instagram direct messages. Public
posts on Twitter, YouTube and Facebook mostly kept theirs.

Analytics has no opinion about a group chat. Had I built my own version and
measured it the obvious way, I would have concluded it spread by public
posting. The screenshot that recruited me and the share I sent on would both
be missing. The page I proposed to my collaborator is built to be
screenshotted, which is to say built for the channel I cannot count.

The fix is cheap, because the unattributed bucket is itself the measurement.
Arrivals with no referrer and no campaign tag estimate how much went through
closed
channels, and comparing that ratio across design variants tests the whole
channel story using a field you were already logging. Coarse geolocation gives
country stratification and a platform's own click identifier gives clustering
within a post.

None of this can be added afterwards. Referrer, campaign tag, coarse
geolocation, arrival timestamp, a first-attempt flag, attention checks: if
those are missing before the first pilot participant, the spread is
unanalysable. This is the part I would have skipped, because it has to
happen when the thing has no users and instrumenting it feels absurd.

That first pilot will probably be your own lab, a tight group of people who
already share the same references, where a planted joke lands and can still
die everywhere else.
[Hinz and colleagues](https://www.marketing.uni-frankfurt.de/fileadmin/Publikationen/Hinz-Skiera-Barrot-Becker-2011-Seeding-Strategies_in_Journal-of-Marketing.pdf)
ran the seeding comparison directly, and starting a campaign with
well-connected people beat starting at random by 39 to 100 percent, and beat
starting with poorly connected people by up to eightfold. Those numbers come
from selling mobile phone contracts, so I take the direction and leave the
magnitudes. The lab stage is still worth running for one thing that stops
being possible the moment the study is loose: asking the people who finished
and did not share why they did not.

## What it still cannot tell you

One class of claim stays out of reach: you cannot say how common something is
in a population.

The Great British Class Survey is the case. It drew 161,400 completed web
surveys through the BBC by July 2011 and hit a
[strong selection bias](https://journals.sagepub.com/doi/full/10.1177/0038038513481128)
toward well-educated groups, so the team commissioned a separate, properly
representative survey of 1,026 people from GfK using identical questions.
Critics argued that almost every claim in the paper rests on those thousand
people, not on the hundred and sixty thousand. Scale is no rescue either: once
data quality is accounted for, the effective sample size of a very large
biased dataset
[can be vanishingly small](https://statistics.fas.harvard.edu/sites/g/files/omnuum10116/files/statistics-2/files/statistical_paradises_and_paradoxes.pdf),
and [an R package](https://github.com/kuriwaki/ddi) will compute how small.

The comparison that matters, though, is with what a lab actually has. A lab
that could afford a national panel would already be using it. The real
alternative is
twenty-four undergraduates from the same department, in the same building, in
one language, which has plenty of bias of its own and no reach at all. So we
swap one bias for a different one and buy a great deal more reach with the
difference. That is usually a good deal, provided you say out loud which bias
you bought and can show that you measured it.

## Where this lands

I started out thinking we could recruit for free. Now I would say participants
pay themselves, in rewards they already wanted, and we settle up in bias
rather than money. Nobody hands us that bias: we pick it when we pick
the reward, because the reward decides the channel and the channel decides who
shows up.

The next step is small enough to do this month. Run the reward audit on an
instrument I already have, transcode one of its outputs, and find out whether
anyone in the lab next door shares it without being asked.

Fifteen minutes of questions did not stop me finishing the country quiz, so I
have given up on the idea that the instrument has to be short. I am fairly
sure the result has to be worth showing someone.
