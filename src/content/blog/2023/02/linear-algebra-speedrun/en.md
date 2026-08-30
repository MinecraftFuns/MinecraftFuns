---
title: "Linear algebra speedrun"
description: "Cram notes for a first linear algebra course: extracting a maximal independent subset, null space bases, change of basis, rank, determinants and LU, the adjugate, diagonalization, Gram-Schmidt, and quadratic forms."
date: "2023-02-21"
tags: ["Notes", "Mathematics", "Linear Algebra"]
---

> Exam-cram notes from February 2023, rebuilt and carefully checked
> afterwards.

## Vectors and independence

### Extracting a maximal independent subset

Given vectors $a_1,\dots,a_k$, select a maximal subset of them that is
linearly independent. A basis of the span could be assembled from
combinations; here the answer must be drawn from the given vectors
themselves.

Put the vectors in as the columns of a matrix $A$, row-reduce to reduced row
echelon form, and note which columns hold pivots. The original columns in
those positions are a maximal linearly independent subset, and there are
$\operatorname{rank}(A)$ of them.

This works because row operations preserve every linear dependence among the
columns. A relation $\sum c_ja_j=0$ is a vector in the null space, row
operations leave the null space untouched, and so the dependencies visible in
the echelon form are the dependencies in the original.

Row-reducing a matrix whose rows are the vectors returns a basis for the span
built out of combinations of the inputs. The singular value decomposition
$A=U\Sigma V^{T}$ gives $\operatorname{rank}(A)$ as the number of nonzero
singular values, with the leading columns of $U$ an orthonormal basis for the
column space. Both describe the span without selecting from the inputs.

### The change of basis matrix

Let $B=(b_1,\dots,b_n)$ and $B'=(b'_1,\dots,b'_n)$ be bases of a vector space
$V$. Express each new basis vector in the old basis:

$$b'_j=\sum_{i=1}^{n}p_{ij}\,b_i .$$

The scalar $p_{ij}$ is the $i$-th coordinate of $b'_j$, so the $j$-th column
of $P$ is the coordinate vector of $b'_j$ in the basis $B$. In matrix form,

$$\begin{bmatrix}b'_1&\cdots&b'_n\end{bmatrix}
=\begin{bmatrix}b_1&\cdots&b_n\end{bmatrix}P .$$

$P$ is invertible, both families being bases. A vector with coordinate column
$y$ with respect to $B'$ has coordinates $Py$ with respect to $B$, and
$P^{-1}$ carries coordinates back.

### A basis for the null space

To solve $Ax=0$, row-reduce $A$ to reduced row echelon form. Variables in
pivot columns are the leading variables, determined by the rest; variables in
non-pivot columns are free. With $r=\operatorname{rank}(A)$ and $n$ columns
there are $n-r$ free variables, and setting one of them to $1$ with the
others at $0$ and back-substituting produces $n-r$ solutions forming a basis
for the null space.

Row operations are the only ones available here. They recombine equations and
leave the solution set alone, whereas column operations recombine the
variables and give the null space of a different system.

## Rank

### Row rank equals column rank

The row rank is the dimension of the span of the rows, the column rank the
dimension of the span of the columns. They agree for every matrix, including
rectangular ones where the two spans live in different spaces.

Reducing $A$ to echelon form establishes that the row rank is the number of
nonzero rows that survive, and a separate argument has to bring the columns
in. A factorization does it. Let $r$ be the column rank and $C$ be
$m\times r$ with columns a basis of the column space. Every column of $A$ is
a combination of those, so $A=CR$ for some $r\times n$ matrix $R$. Read that
product by rows instead: every row of $A$ is a combination of the $r$ rows of
$R$, so the row rank is at most $r$. The same argument applied to $A^{T}$
gives the reverse inequality.

### The geometric reason

An $m\times n$ matrix is a map $\mathbb{R}^n\to\mathbb{R}^m$.

Inside the domain $\mathbb{R}^n$, the null space and the row space are
orthogonal complements, since $Ax=0$ says precisely that $x$ is orthogonal to
every row. So

$$\dim(\text{row space})+\dim(\text{null space})=n,$$

while rank-nullity says

$$\dim(\text{column space})+\dim(\text{null space})=n .$$

Subtract to get the theorem. Geometrically, $A$ annihilates the null space
and maps the row space isomorphically onto the column space. If $x$ lies in
the row space with $Ax=0$, then $x$ is orthogonal to itself and therefore
zero, so the restriction is injective; and splitting any $x$ into row-space
and null-space parts leaves only the first contributing, so the restriction
is onto. The two spaces are copies of one another, which is why their
dimensions match.

The theorem makes rank stable under transposition. Reordering a product is a
different matter: with $A=\begin{bmatrix}1&0\end{bmatrix}$ and
$B=\begin{bmatrix}0\\1\end{bmatrix}$, $AB$ is the $1\times1$ zero matrix of
rank $0$ while $BA$ has rank $1$.

## Determinants

### Cofactor expansion

The minor $M_{ij}$ is the determinant of the submatrix left after deleting
row $i$ and column $j$. The cofactor attaches a sign depending on the parity
of $i+j$:

$$A_{ij}=(-1)^{i+j}M_{ij}.$$

Expanding along any row,

$$\det A=\sum_{j=1}^{n}a_{ij}A_{ij}.$$

The diagonal rule, taking signed products along wrapped diagonals, is valid
only for $n\leq 3$. The full expansion is a sum over all $n!$ permutations
signed by parity, and wrapped diagonals supply just $2n$ of them.

Cramer's rule runs in the other direction, solving a linear system from
determinants already in hand: $x_i=\det(A_i)/\det(A)$, where $A_i$ is $A$
with column $i$ replaced by the right-hand side.

### The adjugate

Collect the cofactors into a matrix $C$ with $C_{ij}=A_{ij}$ and transpose
it, the sign going on once as the cofactor is formed:

$$\operatorname{adj}(A)=C^{T},\qquad \operatorname{adj}(A)_{ij}=C_{ji}.$$

The defining property is

$$A\operatorname{adj}(A)=\operatorname{adj}(A)A=\det(A)\,I,$$

from which $A^{-1}=\frac{1}{\det A}\operatorname{adj}(A)$ when
$\det A\neq0$.

Every square matrix has an adjugate, singular ones included, since it is
assembled from determinants of submatrices and divides by nothing. What a
singular matrix lacks is the inverse. There the identity above reads
$A\operatorname{adj}(A)=0$, and the rank of the adjugate follows from the
rank of $A$: at $\operatorname{rank}(A)=n-1$ the adjugate has rank $1$ and
its columns span the null space of $A$, and below that every
$(n-1)\times(n-1)$ minor vanishes and the adjugate is zero. For
$A=\begin{bmatrix}1&2&3\\4&5&6\\7&8&9\end{bmatrix}$, of rank $2$, the
adjugate is $\begin{bmatrix}-3&6&-3\\6&-12&6\\-3&6&-3\end{bmatrix}$, whose
columns are multiples of $(1,-2,1)$, spanning the null space.

### By elimination

Reduce to triangular form and multiply the diagonal, tracking what each
operation does. Adding a multiple of one row to another leaves the
determinant unchanged, which is what makes elimination usable. Swapping two
rows negates it. Scaling a row by $k$ multiplies it by $k$.

### LU decomposition

Elimination without row swaps factors $A=LU$, with $L$ unit lower triangular
holding the multipliers and $U$ upper triangular. Take

$$A=\begin{bmatrix}2&1&1\\4&3&3\\8&7&9\end{bmatrix}.$$

Eliminating by $R_2-2R_1$, $R_3-4R_1$, then $R_3-3R_2$ leaves

$$U=\begin{bmatrix}2&1&1\\0&1&1\\0&0&2\end{bmatrix},\qquad
L=\begin{bmatrix}1&0&0\\2&1&0\\4&3&1\end{bmatrix},$$

the multipliers $2$, $4$, $3$ sitting at the positions they cleared.

Since $\det L=1$, $\det A=\det U=\prod_i U_{ii}$. For

$$A=\begin{bmatrix}2&1&3\\4&7&7\\6&18&22\end{bmatrix}$$

the multipliers are $2$, $3$, $3$, giving
$U=\begin{bmatrix}2&1&3\\0&5&1\\0&0&10\end{bmatrix}$ and
$\det A=2\cdot5\cdot10=100$, which cofactor expansion confirms.

Not every matrix factors this way. A zero pivot forces a row swap, and the
general statement is $PA=LU$ with $P$ a permutation matrix, whence
$\det A=(-1)^{s}\prod_iU_{ii}$ for $s$ swaps. Numerical work uses partial
pivoting regardless, for stability.

Cofactor expansion is $O(n!)$ and elimination is $O(n^3)$, which is the
difference between infeasible and routine somewhere around $n=20$.

## Eigenvalues and diagonalization

### Computing them

The eigenvalues of an $n\times n$ matrix $A$ are the roots of the
characteristic polynomial $\det(\lambda I-A)=0$, of degree $n$. For each
$\lambda_i$, the eigenvectors are the nonzero solutions of

$$(A-\lambda_i I)x=0 .$$

That system always has nontrivial solutions, which is what being an
eigenvalue means: $\det(A-\lambda_iI)=0$, so the matrix is singular and its
null space is larger than $\{0\}$. The system is homogeneous, so it is never
inconsistent, and its matrix is singular, so the solution is never unique.

Eigenvalues come from the characteristic polynomial first, eigenvectors from
the null space of $A-\lambda I$ second, since the definition of an
eigenvector already presumes a $\lambda$.

For a repeated eigenvalue, take a basis of that null space, the eigenspace.
Its dimension is the geometric multiplicity, which can fall short of the
algebraic multiplicity and never exceeds it.

### When a matrix is diagonalizable

$A$ is diagonalizable when some invertible $P$ makes $P^{-1}AP=D$ diagonal,
equivalently $A=PDP^{-1}$ with the columns of $P$ eigenvectors and the
diagonal of $D$ their eigenvalues.

The criterion is that $A$ has $n$ linearly independent eigenvectors, which
holds exactly when geometric multiplicity equals algebraic multiplicity for
every eigenvalue.

An $A$ with $n$ distinct eigenvalues is diagonalizable, because eigenvectors
belonging to distinct eigenvalues are always linearly independent, which
makes distinctness the cheapest sufficient test available. It is sufficient
without being necessary: the identity matrix has a single eigenvalue and is
already diagonal.

Failure requires a repeated eigenvalue whose eigenspace is too small. The
smallest instance is

$$\begin{bmatrix}2&1\\0&2\end{bmatrix},$$

with eigenvalue $2$ of algebraic multiplicity $2$ and a one-dimensional
eigenspace. Such a matrix is similar to a Jordan form whose blocks exceed
$1\times 1$.

## Gram-Schmidt

Given linearly independent $a_1,\dots,a_k$, set $q_1=a_1/\lVert a_1\rVert$
and, for each $j$ in turn,

$$v_j=a_j-\sum_{i<j}(a_j\cdot q_i)\,q_i,\qquad q_j=\frac{v_j}{\lVert v_j\rVert}.$$

Each step strips from $a_j$ its projection onto everything already
orthonormalized, leaving the part orthogonal to that span.

Correctness is an induction. Suppose $q_1,\dots,q_{j-1}$ are orthonormal. For
any $i<j$,

$$q_i\cdot v_j=q_i\cdot a_j-\sum_{l<j}(a_j\cdot q_l)(q_i\cdot q_l)
=q_i\cdot a_j-(a_j\cdot q_i)=0,$$

since $q_i\cdot q_l$ vanishes unless $l=i$, where it is $1$. So $v_j$ is
orthogonal to all its predecessors, and normalizing preserves that.

If $a_j$ lies in the span of its predecessors, $v_j$ is $0$ and the
normalization divides by zero, which is how the algorithm reports the
dependence.

Collecting the $q_j$ as columns of $Q$ gives $A=QR$ with $R$ upper
triangular. In floating point, classical Gram-Schmidt loses orthogonality
badly; modified Gram-Schmidt and Householder reflections are what numerical
libraries use.

## Quadratic forms

### Definition

A quadratic form in $n$ variables is a homogeneous polynomial of degree two,

$$Q(x_1,\dots,x_n)=\sum_{i=1}^{n}\sum_{j=1}^{n}a_{ij}x_ix_j=x^{T}Ax .$$

Take $A$ symmetric. Nothing is lost, since $x^{T}Ax$ and
$x^{T}\!\left(\frac{A+A^{T}}{2}\right)\!x$ agree for every $x$, and symmetry
delivers the real eigenvalues and orthogonal eigenbasis everything below
relies on.

Cross terms $x_ix_j$ with $i\neq j$ are degree two and belong here. They are
what diagonalization clears.

### Standard form and normal form

The standard form is what an orthogonal change of variables produces. By the
spectral theorem a real symmetric $A$ factors as $A=PDP^{T}$ with $P$
orthogonal, so $P^{T}AP=D$, and substituting $x=Py$ gives

$$Q=\lambda_1y_1^2+\cdots+\lambda_ny_n^2$$

with the $\lambda_i$ the eigenvalues of $A$. The $y_i$ are the new
coordinates; the eigenvectors are the columns of $P$.

The normal form allows any nonsingular change of variables, which can rescale
each coordinate and drive every nonzero coefficient to $\pm1$:

$$Q=y_1^2+\cdots+y_p^2-y_{p+1}^2-\cdots-y_{p+q}^2 .$$

Sylvester's law of inertia says $p$ and $q$ do not depend on the route taken.
The standard form keeps the eigenvalues; the normal form keeps only their
signs.

Eigenvectors for distinct eigenvalues of a symmetric matrix are automatically
orthogonal, so normalizing is enough for them. Within a repeated eigenvalue
any basis of the eigenspace will do, and it has to be orthonormalized by
Gram-Schmidt before going into $P$; the product $PDP^{T}$ then reassembles
$A$.

### Definiteness

For a real symmetric $A$:

- Positive definite: $Q(x)>0$ for all $x\neq 0$, equivalently every
  eigenvalue is positive.
- Negative definite: $Q(x)<0$ for all $x\neq 0$, equivalently every
  eigenvalue is negative.
- Positive semidefinite: $Q(x)\geq0$ for all $x$, equivalently every
  eigenvalue is nonnegative.
- Negative semidefinite: $Q(x)\leq0$ for all $x$, equivalently every
  eigenvalue is nonpositive.
- Indefinite: $Q$ takes both signs, equivalently eigenvalues of both signs
  occur.

Each criterion quantifies over all the eigenvalues, so semidefiniteness turns
on the absence of eigenvalues of the opposite sign. A zero eigenvalue rules
out the strict forms and decides nothing further: eigenvalues $1$, $0$ and
$-1$ give an indefinite form, while $1$, $0$ and $0$ give a positive
semidefinite one.
