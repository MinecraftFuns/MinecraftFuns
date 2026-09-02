---
title: "Calculus speedrun"
description: "Cram notes for single-variable calculus: differentiability, equivalent infinitesimals, Taylor remainders, integration technique, the Wallis integrals and product, ordinary differential equations, and curvature."
date: "2023-02-20"
tags: ["Notes", "Mathematics", "Calculus"]
---

> Exam-cram notes from February 2023, rebuilt and carefully checked
> afterwards.

## Derivatives

### Differentiability and the differential

A function $f$ is differentiable at $x_0$ when some constant $k$ satisfies

$$
\lim_{\Delta x\to 0}\frac{f(x_0+\Delta x)-f(x_0)-k\,\Delta x}{\Delta x}=0.
$$

That $k$ is the derivative $f'(x_0)$. The definition says $f$ can be
approximated near $x_0$ by an affine function whose error shrinks faster than
$\Delta x$ does.

The derivative and the differential are different objects. The differential
is the linear part, $\mathrm{d}f=f'(x_0)\,\mathrm{d}x$, a function of
$\mathrm{d}x$. In one variable the distinction buys little and the two get
used interchangeably. In several variables it stops being optional.

### Continuity and differentiability

Differentiable implies continuous, and the converse fails.

Take $f(x)=|x|$ at $x=0$. It is continuous there and not differentiable
there: the left derivative is $-1$, the right derivative is $+1$, and a
derivative exists exactly when the one-sided derivatives exist and agree.

The [Weierstrass function](https://en.wikipedia.org/wiki/Weierstrass_function)
is continuous on all of $\mathbb{R}$ and differentiable nowhere, so
continuity constrains differentiability hardly at all.

### The mean value theorem

If $f$ is continuous on $[a,b]$ and differentiable on $(a,b)$, some
$c\in(a,b)$ has

$$
f'(c)=\frac{f(b)-f(a)}{b-a}.
$$

The average rate of change across the interval is attained as an
instantaneous rate somewhere inside it.
[Rolle's theorem](https://en.wikipedia.org/wiki/Rolle%27s_theorem) is the
case $f(a)=f(b)$, and each implies the other in a line.

## Limits

### Equivalent infinitesimals

Two infinitesimals $\alpha(x)$ and $\beta(x)$ as $x\to x_0$ are equivalent,
written $\alpha\sim\beta$, when their ratio tends to one:

$$
\lim_{x\to x_0}\frac{\alpha(x)}{\beta(x)}=1.
$$

Substituting equivalents is legitimate for factors of a product or quotient.
Across a sum the leading terms can cancel, leaving the answer in the part
that was discarded. With $\tan x\sim x$ and
$\sin x\sim x$ as $x\to 0$, replacing both in

$$
\lim_{x\to 0}\frac{\tan x-\sin x}{x^3}
$$

gives $0$, while the limit is $\tfrac12$. Subtraction annihilates the linear
terms and what survives is cubic.

### L'Hôpital's rule

The rule applies to $\frac{0}{0}$ and $\frac{\infty}{\infty}$, given $f$ and
$g$ differentiable near the point with $g'\neq 0$ there. Every other
indeterminate form has to be pushed algebraically into one of those two
shapes first.

It concludes only when $\lim f'/g'$ exists or is infinite. Where that limit
does not exist, the rule yields no information about $f/g$, which may still
be perfectly well behaved:

$$
\lim_{x\to\infty}\frac{x+\sin x}{x}=1,
$$

whose ratio of derivatives is $1+\cos x$, oscillating in $[0,2]$ forever.

Each application costs a differentiation, and on $\frac{\sin x}{x}$ the rule
argues in a circle, since the derivative of $\sin$ is the thing being
established.

## Taylor expansion

For $f$ with enough derivatives at $a$,

$$
f(x)=\sum_{k=0}^{n}\frac{f^{(k)}(a)}{k!}(x-a)^k+R_n(x).
$$

[Maclaurin's expansion](https://en.wikipedia.org/wiki/Taylor_series) is this
with $a=0$.

The two standard remainders answer different questions. The Peano remainder
is qualitative,

$$
R_n(x)=o\big((x-a)^n\big)\quad (x\to a),
$$

and needs only that $f$ be $n$ times differentiable at $a$. It says the error
is of smaller order than the last term kept, which is enough to compute a
limit and gives no numerical bound anywhere.

The Lagrange remainder is quantitative,

$$
R_n(x)=\frac{f^{(n+1)}(\xi)}{(n+1)!}(x-a)^{n+1}
$$

for some $\xi$ between $a$ and $x$, and needs $n+1$ derivatives across the
interval. Both the derivative order and the power are $n+1$.

## Integration

### The techniques

1. Basic formulas. $\int\cos x\,\mathrm{d}x=\sin x+C$,
   $\int\frac{\mathrm{d}x}{x}=\ln|x|+C$,
   $\int\frac{\mathrm{d}x}{x^2+a^2}=\frac1a\arctan\frac{x}{a}+C$,
   $\int\frac{\mathrm{d}x}{\sqrt{x^2+a^2}}=\ln\left|x+\sqrt{x^2+a^2}\right|+C$.
1. Substitution, running in either direction. You recognize $\mathrm{d}u$
   inside the integrand and collapse it, or you introduce a new variable to
   clear a radical. Trigonometric substitution is the second direction:
   $\sqrt{a^2-x^2}$ wants $x=a\sin t$, $\sqrt{a^2+x^2}$ wants $x=a\tan t$,
   and $\sqrt{x^2-a^2}$ wants $x=a\sec t$.
1. Integration by parts, $\int u\,\mathrm{d}v=uv-\int v\,\mathrm{d}u$. So
   $\int xe^x\mathrm{d}x=xe^x-e^x+C$ and
   $\int x\cos x\,\mathrm{d}x=x\sin x+\cos x+C$.
1. Partial fractions for rational integrands. For $\frac{x+2}{x^2+x-6}$ the
   denominator factors as $(x+3)(x-2)$, and solving for the coefficients
   gives $\frac{1}{5(x+3)}+\frac{4}{5(x-2)}$.
1. Trigonometric identities, to drop a power before integrating:
   $\int\sin^2 x\,\mathrm{d}x=\int\frac{1-\cos 2x}{2}\mathrm{d}x$.
1. Reduction formulas, derived by parts. On $[0,\frac{\pi}{2}]$,
   $\int_0^{\pi/2}\cos^n x\,\mathrm{d}x
   =\frac{n-1}{n}\int_0^{\pi/2}\cos^{n-2}x\,\mathrm{d}x$.
1. Symmetry: an odd integrand over $[-a,a]$ integrates to zero, an even one
   to twice the half-interval.

### Worked examples

The denominator of $\int\frac{\sin x}{\sin x+\cos x}\,\mathrm{d}x$ has
derivative $\cos x-\sin x$, which surfaces once the integral is paired with
its companion. Let

$$
I=\int\frac{\sin x}{\sin x+\cos x}\mathrm{d}x,\qquad J=\int\frac{\cos x}{\sin x+\cos x}\mathrm{d}x.
$$

Then $I+J=\int\mathrm{d}x=x$, while $J-I$ has numerator $\cos x-\sin x$,
exactly the derivative of the denominator, so $J-I=\ln|\sin x+\cos x|$.
Subtracting,

$$
I=\frac{x}{2}-\frac{1}{2}\ln|\sin x+\cos x|+C.
$$

For $\int\frac{x^3}{(x^2+1)^2}\mathrm{d}x$, put $u=x^2+1$, so
$x\,\mathrm{d}x=\tfrac12\mathrm{d}u$ and $x^2=u-1$. The integral becomes
$\frac12\int\frac{u-1}{u^2}\mathrm{d}u
=\frac12\int\left(\frac1u-\frac1{u^2}\right)\mathrm{d}u$, giving

$$
\frac{1}{2}\ln(x^2+1)+\frac{1}{2(x^2+1)}+C.
$$

For $\int\frac{\mathrm{d}x}{\sqrt{4-x^2}}$, put $x=2\sin t$ with
$t\in[-\frac{\pi}{2},\frac{\pi}{2}]$, so $\mathrm{d}x=2\cos t\,\mathrm{d}t$
and $\sqrt{4-x^2}=2\cos t$, leaving
$\int\mathrm{d}t=\arcsin\frac{x}{2}+C$.

For $\int\sqrt{x^2-1}\,\mathrm{d}x$, put $x=\sec t$, so the differential is
$\sec t\tan t\,\mathrm{d}t$ and the radical is $|\tan t|$, making the
integrand $\sec t\tan^2 t=\sec^3 t-\sec t$. Integrating $\sec^3 t$ by parts
and substituting back,

$$
\int\sqrt{x^2-1}\,\mathrm{d}x=\frac{x\sqrt{x^2-1}}{2}-\frac{1}{2}\ln\left|x+\sqrt{x^2-1}\right|+C.
$$

### Wallis integrals

The [Wallis integrals](https://en.wikipedia.org/wiki/Wallis'_integrals) are

$$
W_n=\int_0^{\pi/2}\sin^n x\,\mathrm{d}x=\int_0^{\pi/2}\cos^n x\,\mathrm{d}x,
$$

the two forms agreeing under $x\mapsto\frac{\pi}{2}-x$. Integration by parts
gives $W_n=\frac{n-1}{n}W_{n-2}$ for $n\geq 2$, with $W_0=\frac{\pi}{2}$ and
$W_1=1$, so

$$
W_2=\frac{\pi}{4},\qquad W_3=\frac{2}{3},\qquad W_4=\frac{3\pi}{16}.
$$

The sequence satisfies $nW_nW_{n-1}=\frac{\pi}{2}$ for every $n$, and
decays as $W_n\sim\sqrt{\frac{\pi}{2n}}$. Even terms carry a $\pi$ and odd
terms are rational, which is the asymmetry the product below is built out
of.

### Wallis's product

$$
\frac{\pi}{2}=\prod_{n=1}^{\infty}\frac{2n\cdot 2n}{(2n-1)(2n+1)}=\frac{2}{1}\cdot\frac{2}{3}\cdot\frac{4}{3}\cdot\frac{4}{5}\cdot\frac{6}{5}\cdot\frac{6}{7}\cdots
$$

John Wallis found this in 1655 and published it in
[Arithmetica Infinitorum](https://www.maa.org/press/maa-reviews/the-arithmetic-of-infinitesimals-john-wallis-1656)
the following year, the
[second infinite product for $\pi$](https://en.wikipedia.org/wiki/Wallis_product)
after Viète's of 1593.

The proof runs entirely through the integrals above. The sequence $W_n$ is
positive and strictly decreasing, so $W_{2n+1}\leq W_{2n}\leq W_{2n-1}$;
dividing through by $W_{2n+1}$ and applying the recurrence squeezes
$W_{2n}/W_{2n+1}$ to $1$, and writing that ratio out in closed form is the
product.

Convergence is slow enough to rule the product out as a way of computing
$\pi$. A thousand factors give $3.14081$ against $\pi=3.14159$, with the
error falling like $1/n$.

A related identity,

$$
\frac{\sin x}{x}=\cos\frac{x}{2}\cos\frac{x}{4}\cos\frac{x}{8}\cdots,
$$

yields
[Viète's product](https://en.wikipedia.org/wiki/Vi%C3%A8te%27s_formula): at
$x=\frac{\pi}{2}$ the left side is $\frac{2}{\pi}$.

### Improper integrals

Two kinds, split by where the infinity sits.

The first kind has an unbounded interval. Define
$\int_a^{\infty}f=\lim_{b\to\infty}\int_a^b f$ and call it convergent when
that limit is finite.

The second kind has an unbounded integrand at a finite point. Approach the
bad point with a parameter and take the limit the same way. Where $f$ stays
bounded and the discontinuity is removable, the integral is proper and needs
no limit.

Either kind is tested by comparison against a known integrand, by limit
comparison on the ratio, or by absolute convergence, which implies
convergence. The benchmarks are the $p$-integrals, and they point in opposite
directions: $\int_1^{\infty}\frac{\mathrm{d}x}{x^p}$ converges exactly when
$p>1$, while $\int_0^{1}\frac{\mathrm{d}x}{x^p}$ converges exactly when
$p<1$.

## Differential equations

### Separable equations

For $y'=f(x)g(y)$,

$$
\int\frac{\mathrm{d}y}{g(y)}=\int f(x)\,\mathrm{d}x+C.
$$

Dividing by $g(y)$ assumes it is nonzero. Each root of $g$ gives a constant
solution, and those are read off separately.

### Homogeneous equations

For $y'=f\!\left(\frac{y}{x}\right)$, substitute $y=vx$, so $y'=v+xv'$ and

$$
x\frac{\mathrm{d}v}{\mathrm{d}x}=f(v)-v,
$$

which separates, the substitution having promoted a ratio to a variable.

### First-order linear equations

For $y'+p(x)y=q(x)$, the integrating factor is
$\mu(x)=e^{\int p(x)\mathrm{d}x}$. It comes from asking for a $\mu$ that
makes the left side a single derivative. Expanding,

$$
(\mu y)'=\mu y'+\mu' y,
$$

which should equal $\mu y'+\mu p y$. Matching forces $\mu'=\mu p$, itself
separable, and $\mu=e^{\int p}$ follows.

Then $(\mu y)'=\mu q$, so

$$
y=\frac{1}{\mu(x)}\left(\int\mu(x)q(x)\,\mathrm{d}x+C\right)=e^{-\int p}\left(\int qe^{\int p}\mathrm{d}x+C\right),
$$

with the outer $e^{-\int p}$ multiplying both terms inside. For constant
$p\neq 0$ and constant $q$ this collapses to $y=Ae^{-px}+\frac{q}{p}$.

### Constant coefficients

For $y''+ay'+by=0$ with $a,b$ constant, substituting $y=e^{rx}$ gives the
characteristic equation $r^2+ar+b=0$. Three cases:

1. Distinct real roots $r_1\neq r_2$: $y=c_1e^{r_1x}+c_2e^{r_2x}$.
1. A repeated root $r$: $y=(c_1+c_2x)e^{rx}$. The factor of $x$ supplies the
   second solution that a second-order equation needs.
1. Complex roots $\alpha\pm\beta i$:
   $y=e^{\alpha x}(c_1\cos\beta x+c_2\sin\beta x)$.

The characteristic equation exists because the coefficients are constants. An
equation with variable coefficients admits no such polynomial in $r$, since
$r$ would have to depend on $x$ and $e^{rx}$ would lose the derivatives the
substitution assumed. Variable-coefficient second-order equations are
genuinely harder and have no comparable general method.

### Undetermined coefficients

For $y''+ay'+by=f(x)$ the general solution is $y=y_h+y_p$, the homogeneous
general solution plus any one particular solution.

Where $f$ has the form $e^{\alpha x}(P(x)\cos\beta x+Q(x)\sin\beta x)$ with
$P,Q$ polynomial, guess a $y_p$ of that same shape with undetermined
coefficients, substitute, and match. A polynomial $f$ of degree $m$ calls for
a general polynomial of degree $m$, lower-order terms included.

Resonance decides whether the guess can work at all. A trial form that
already solves the homogeneous equation cannot also produce a nonzero
right-hand side, and substituting it returns $0=f(x)$. Multiply the trial
form by $x^s$, where $s$ is the multiplicity of $\alpha+\beta i$ as a root of
the characteristic equation.

### Variation of parameters

Let the constants in the homogeneous solution vary. For $y'+p(x)y=q(x)$,
write $y_p=u(x)e^{-\int p}$; substituting collapses the $p$ terms and leaves
$u'=qe^{\int p}$, so $y_p=e^{-\int p}\int qe^{\int p}\mathrm{d}x$, agreeing
with the integrating factor.

For $y''+ay'+by=f(x)$ with homogeneous solutions $y_1,y_2$, the same move
writes $y_p=u_1y_1+u_2y_2$, imposes $u_1'y_1+u_2'y_2=0$, and solves the
resulting pair for $u_1'$ and $u_2'$:

$$
y_p=-y_1\int\frac{y_2f}{W}\,\mathrm{d}x+y_2\int\frac{y_1f}{W}\,\mathrm{d}x,\qquad W=y_1y_2'-y_1'y_2.
$$

Variation of parameters asks only that $f$ be continuous, so it handles
right-hand sides like $\tan x$ or $\frac1x$ that no trial form covers.
Undetermined coefficients stays confined to exponentials, polynomials, sines
and cosines.

### Linear systems

A first-order system

$$
\frac{\mathrm{d}\mathbf{x}}{\mathrm{d}t}=A\mathbf{x}+\mathbf{f}(t)
$$

with $A$ a constant matrix has homogeneous solution
$\mathbf{x}_h(t)=e^{At}\mathbf{c}$, and variation of parameters gives

$$
\mathbf{x}(t)=e^{At}\left(\mathbf{c}+\int_0^t e^{-As}\mathbf{f}(s)\,\mathrm{d}s\right).
$$

Diagonalizing $A$ turns $e^{At}$ into an exponential of each eigenvalue on
its own and uncouples the system into independent scalar equations. A
defective $A$ needs the
[Jordan form](https://en.wikipedia.org/wiki/Jordan_normal_form) and produces
polynomial factors in $t$, the same phenomenon as the repeated root above.

## Curvature

For a curve $\mathbf{r}(t)$,

$$
\kappa=\frac{|\mathbf{r}'(t)\times\mathbf{r}''(t)|}{|\mathbf{r}'(t)|^3}.
$$

Parametrized by arc length instead,
$\kappa=\left|\frac{\mathrm{d}\mathbf{T}}{\mathrm{d}s}\right|$ with
$\mathbf{T}$ the unit tangent, and no denominator is needed, since
$\left|\frac{\mathrm{d}\mathbf{r}}{\mathrm{d}s}\right|=1$ is what arc-length
parametrization means.

For an explicit curve $y=f(x)$ at the point $(x_0,f(x_0))$,

$$
\kappa=\frac{|f''(x_0)|}{\left(1+f'(x_0)^2\right)^{3/2}}.
$$

At a critical point, where $f'(x_0)=0$, the denominator is $1$ and
$\kappa=|f''(x_0)|$. Large $|f'|$ drives $\kappa$ down, and for
twice-differentiable $f$ the curvature is finite everywhere.

A straight line has $\kappa=0$; a circle of radius $r$ has $\kappa=\frac1r$
at every point. The units follow: curvature is an inverse length, and
$\frac1\kappa$ is the radius of the circle that best fits the curve there.
